const mongoose = require('mongoose');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const MeasurementTemplate = require('../models/MeasurementTemplate');
const Notification = require('../models/Notification');
const { getStripe } = require('../config/stripe');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { generateOrderQR } = require('../utils/qrCode');
const { sendEmail, templates } = require('../utils/email');
const logger = require('../utils/logger');
const { escapeRegex, buildPhoneSearchPattern, isPastDate } = require('../utils/common');

const SUPPORTED_GARMENT_TYPES = ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta'];
const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10);
const RETURN_REASONS = ['size_issue', 'wrong_item', 'defective', 'not_as_described', 'changed_mind', 'other'];
const RETURN_REFUND_RECEIVE_METHODS = ['upi_id', 'bank_account', 'collect_from_shop'];

const getDeliveredAt = (order = {}) => {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const deliveredEntries = history.filter((entry) => entry?.status === 'delivered' && entry?.updatedAt);
  if (deliveredEntries.length > 0) {
    return new Date(deliveredEntries[deliveredEntries.length - 1].updatedAt);
  }
  if (order.status === 'delivered') return new Date(order.updatedAt || order.createdAt);
  return null;
};

const isReturnEligibleProduct = (product = {}) => {
  const mainCategory = String(product.mainCategory || '').trim();
  const subCategory = String(product.subCategory || '').trim();

  if (mainCategory === 'Accessories') return true;
  if (mainCategory === 'Clothes' && subCategory === 'Ready-to-Wear') return true;
  return false;
};

const hasRealReturnRequest = (item = {}) => {
  const request = item?.returnRequest;
  if (!request?.status) return false;

  return Boolean(
    request.reason ||
    request.requestedAt ||
    request.reviewedAt ||
    request.adminNote ||
    request.pickupDate ||
    Number(request.refundAmount || 0) > 0
  );
};

const getOrderItemDisplayName = (item = {}) => (
  item?.product?.productName
  || item?.product?.name
  || item?.productName
  || item?.name
  || `Item ${String(item?._id || '').slice(-6).toUpperCase()}`
);

const restoreReturnedItemStock = async (item = {}) => {
  const productId = item?.product?._id || item?.product;
  const qty = Number(item?.qty || 0);

  if (!productId || qty <= 0) return false;

  // Prefer variant-level restock when variantId exists.
  if (item?.variantId) {
    const variantUpdate = await Product.findOneAndUpdate(
      { _id: productId, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': qty, totalStock: qty } }
    );
    if (variantUpdate) return true;
  }

  const productUpdate = await Product.findByIdAndUpdate(
    productId,
    { $inc: { totalStock: qty } }
  );

  return Boolean(productUpdate);
};

const getReturnEligibilityMeta = (order, item) => {
  const product = item?.product || {};
  const deliveredAt = getDeliveredAt(order);
  const hasRequest = hasRealReturnRequest(item);
  const returnWindowMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const isWithinWindow = deliveredAt
    ? (Date.now() - new Date(deliveredAt).getTime()) <= returnWindowMs
    : false;
  const eligibleProduct = isReturnEligibleProduct(product);
  const canRequest = !hasRequest && order?.status === 'delivered' && eligibleProduct && isWithinWindow;

  return {
    canRequest,
    eligibleProduct,
    isWithinWindow,
    returnWindowDays: RETURN_WINDOW_DAYS,
    deliveredAt,
    reason: !eligibleProduct
      ? 'Returns are available only for ready-made clothes and accessories'
      : order?.status !== 'delivered'
        ? 'Returns can be requested only after order delivery'
        : !isWithinWindow
          ? `Return window (${RETURN_WINDOW_DAYS} days) has expired`
          : hasRequest
            ? 'Return request already exists for this item'
            : '',
  };
};

const normalizeOrderForResponse = (orderDoc) => {
  if (!orderDoc) return null;
  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  order.items = (order.items || []).map((item) => ({
    ...item,
    returnMeta: getReturnEligibilityMeta(order, item),
  }));
  return order;
};

const inferGarmentType = (item = {}, product = {}) => {
  const raw = `${item.garmentType || ''} ${product.itemCategory || ''} ${product.productName || product.name || ''}`.toLowerCase();
  if (raw.includes('pant') || raw.includes('trouser') || raw.includes('jeans')) return 'Pants';
  if (raw.includes('blazer') || raw.includes('coat')) return 'Blazer';
  if (raw.includes('jodhpuri')) return 'Jodhpuri';
  if (raw.includes('indo') || raw.includes('western')) return 'Indo-Western';
  if (raw.includes('sherwani')) return 'Sherwani';
  if (raw.includes('kurta')) return 'Kurta';
  return 'Shirt';
};

const normalizeGarmentType = (value, fallback = 'Shirt') => (
  SUPPORTED_GARMENT_TYPES.includes(value) ? value : fallback
);

const sanitizeOrderMeasurementOwnership = (orderDoc) => {
  if (!orderDoc) return orderDoc;
  const ownerId = orderDoc.customer?._id ? String(orderDoc.customer._id) : String(orderDoc.customer || '');
  if (!ownerId) return orderDoc;

  (orderDoc.items || []).forEach((item) => {
    const tpl = item?.measurementTemplateId;
    if (!tpl) return;
    const tplOwner = tpl.customer?._id ? String(tpl.customer._id) : String(tpl.customer || '');
    if (tplOwner && tplOwner !== ownerId) {
      item.measurementTemplateId = undefined;
    }
  });

  const stitchingTemplate = orderDoc.stitchingDetails?.measurementTemplate;
  if (stitchingTemplate) {
    const tplOwner = stitchingTemplate.customer?._id
      ? String(stitchingTemplate.customer._id)
      : String(stitchingTemplate.customer || '');
    if (tplOwner && tplOwner !== ownerId) {
      orderDoc.stitchingDetails.measurementTemplate = undefined;
    }
  }

  return orderDoc;
};

// ── helpers ────────────────────────────────────────────────────────────────────
// Safely start a Mongoose session. Returns null when the MongoDB deployment
// is a standalone (no replica-set) and therefore can't run transactions.
const tryStartSession = async () => {
  try {
    const admin = mongoose.connection?.db?.admin?.();
    if (!admin) return null;

    // Transactions are only supported on replica set members or mongos.
    const hello = await admin.command({ hello: 1 });
    const isReplicaSet = Boolean(hello?.setName);
    const isMongos = hello?.msg === 'isdbgrid';
    if (!isReplicaSet && !isMongos) {
      return null;
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  } catch (_) {
    return null; // standalone MongoDB — proceed without transactions
  }
};

const safeAbort = async (session) => {
  if (!session) return;
  try { await session.abortTransaction(); } catch (_) { }
  try { session.endSession(); } catch (_) { }
};

const safeCommit = async (session) => {
  if (!session) return;
  try { await session.commitTransaction(); } catch (_) { }
  try { session.endSession(); } catch (_) { }
};

// Save a document with optional session
const saveDoc = (doc, session) => session ? doc.save({ session }) : doc.save();

const buildStitchingMeta = async ({ item, product, customerId, session }) => {
  if (!item?.isStitching || !item?.measurementPreference) return {};

  const inferredGarmentType = inferGarmentType(item, product);
  const garmentType = normalizeGarmentType(item.garmentType, inferredGarmentType);

  const meta = {
    measurementPreference: item.measurementPreference,
    measurementSlotId: item.measurementSlotId || undefined,
    garmentType,
  };

  const ownMeasurements = item.ownMeasurements && typeof item.ownMeasurements === 'object'
    ? item.ownMeasurements
    : null;

  if (ownMeasurements && Object.keys(ownMeasurements).length > 0) {
    meta.ownMeasurements = ownMeasurements;
  }

  if (item.measurementPreference === 'own_measurement' && ownMeasurements && Object.keys(ownMeasurements).length > 0) {
    const template = new MeasurementTemplate({
      customer: customerId,
      garmentType,
      name: `${product.productName || product.name || 'Custom Fit'} - Self`,
      measurements: ownMeasurements,
      notes: 'Auto-created from customer self measurements during checkout',
      isDefault: false,
    });

    await saveDoc(template, session);
    meta.measurementTemplateId = template._id;
    return meta;
  }

  meta.measurementTemplateId = item.measurementTemplateId || undefined;
  return meta;
};

// POST /api/orders
const createOrder = async (req, res) => {
  const session = await tryStartSession();
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      stripePaymentIntentId,
      couponCode,
      stitchingDetails,
      isPickup = false,
      notes,
    } = req.body;

    if (!items || items.length === 0) {
      await safeAbort(session);
      return errorResponse(res, 400, 'Order must have at least one item');
    }

    if (paymentMethod === 'COD' && items.some((i) => i.isStitching)) {
      await safeAbort(session);
      return errorResponse(res, 400, 'Cash on Delivery is not available for orders containing custom stitching items');
    }

    // ── 1. Load user (lean read, updated atomically later) ────────────────────
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      await safeAbort(session);
      return errorResponse(res, 404, 'User not found');
    }

    const isPrepaidMethod = ['UPI', 'credit_card', 'debit_card', 'stripe'].includes(paymentMethod);
    let resolvedStripePaymentId = undefined;

    if (isPrepaidMethod && stripePaymentIntentId) {
      const existingOrder = await Order.findOne({ stripePaymentIntentId }).populate('items.product', 'name');
      if (existingOrder) {
        if (String(existingOrder.customer) !== String(req.user._id)) {
          await safeAbort(session);
          return errorResponse(res, 403, 'Payment intent does not belong to this user');
        }
        return successResponse(res, 200, 'Order already created for this payment', { order: existingOrder });
      }
    }

    if (isPrepaidMethod) {
      if (!stripePaymentIntentId) {
        await safeAbort(session);
        return errorResponse(res, 400, 'Successful payment is required before placing prepaid order');
      }

      const stripe = getStripe();
      if (!stripe || stripePaymentIntentId.includes('sim_')) {
        resolvedStripePaymentId = `sim_pay_${Date.now()}`;
      } else {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
          await safeAbort(session);
          return errorResponse(res, 400, `Payment not successful: status is ${paymentIntent.status}`);
        }

        if (paymentIntent.metadata?.userId && paymentIntent.metadata.userId !== req.user._id.toString()) {
          await safeAbort(session);
          return errorResponse(res, 403, 'Payment intent does not belong to this user');
        }

        resolvedStripePaymentId = paymentIntent.charges?.data?.[0]?.id || paymentIntent.id;
      }
    }

    // ── 2. Stock validation & atomic deduction ────────────────────────────────
    let subtotal = 0;
    const populatedItems = [];

    for (const item of items) {
      if (!item.product) {
        await safeAbort(session);
        return errorResponse(res, 400, 'Each item must have a product ID');
      }

      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        await safeAbort(session);
        return errorResponse(res, 400, 'Product not found or inactive');
      }

      let price = Number(product.price || 0);

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) {
          await safeAbort(session);
          return errorResponse(res, 400, `Variant not found for product ${product.name}`);
        }
        if (variant.stock < item.qty) {
          await safeAbort(session);
          return errorResponse(res, 400, `Insufficient stock for ${product.name}. Available: ${variant.stock}`);
        }

        if (variant.price != null && !Number.isNaN(Number(variant.price))) {
          price = Number(variant.price);
        } else {
          price += Number(variant.additionalPrice || 0);
        }

        // Atomic stock deduction via positional operator — bypasses pre-save hook entirely
        await Product.findOneAndUpdate(
          { _id: product._id, 'variants._id': variant._id },
          {
            $inc: {
              'variants.$.stock': -item.qty,
              totalStock: -item.qty,
              soldCount: item.qty,
            },
          }
        );

        const stitchingMeta = await buildStitchingMeta({
          item,
          product,
          customerId: req.user._id,
          session,
        });

        populatedItems.push({
          product: product._id,
          variantId: variant._id,
          variantDetails: { size: variant.size, color: variant.color, fabric: variant.fabric },
          qty: item.qty,
          price,
          isStitching: item.isStitching || false,
          note: typeof item.note === 'string' ? item.note.trim().slice(0, 500) : undefined,
          ...stitchingMeta,
        });
      } else {
        const stitchingMeta = await buildStitchingMeta({
          item,
          product,
          customerId: req.user._id,
          session,
        });

        populatedItems.push({
          product: product._id,
          qty: item.qty,
          price,
          isStitching: item.isStitching || false,
          note: typeof item.note === 'string' ? item.note.trim().slice(0, 500) : undefined,
          ...stitchingMeta,
        });
      }
      subtotal += price * item.qty;
    }

    // ── 3. Coupon ─────────────────────────────────────────────────────────────
    let discountAmount = 0;
    let couponApplied = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!coupon) {
        await safeAbort(session);
        return errorResponse(res, 400, 'Invalid coupon code');
      }
      const validity = coupon.isValid(subtotal, req.user._id);
      if (!validity.valid) {
        await safeAbort(session);
        return errorResponse(res, 400, validity.message);
      }
      discountAmount = coupon.calculateDiscount(subtotal);
      couponApplied = { code: coupon.code, discountAmount, couponId: coupon._id };

      // Atomic coupon update — no pre-save hook
      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { usedCount: 1 },
        $push: { usedBy: req.user._id },
      });
    }

    const hasStitching = populatedItems.some((i) => i.isStitching);
    const shippingCharge = ((subtotal - discountAmount) > 1999 || hasStitching) ? 0 : 100;
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingCharge);

    // ── 4. QR code (non-fatal) ────────────────────────────────────────────────
    let qrCode = '';
    try {
      qrCode = await generateOrderQR(`ORDER-${Date.now()}`);
    } catch (qrErr) {
      logger.warn('QR code generation failed (non-fatal):', qrErr.message);
    }

    // ── 5. Create & save order ────────────────────────────────────────────────
    const order = new Order({
      customer: req.user._id,
      items: populatedItems,
      shippingAddress,
      subtotal,
      discountAmount,
      shippingCharge,
      totalAmount,
      paymentMethod,
      paymentStatus: isPrepaidMethod ? 'paid' : 'pending',
      stripePaymentIntentId: isPrepaidMethod ? stripePaymentIntentId : undefined,
      stripePaymentId: isPrepaidMethod ? resolvedStripePaymentId : undefined,
      couponApplied: couponApplied || undefined,
      stitchingDetails: stitchingDetails || undefined,
      isPickup,
      notes: notes || undefined,
      qrCode,
      statusHistory: [{
        status: 'received',
        updatedBy: req.user._id,
        note: isPrepaidMethod ? 'Order placed after successful payment' : 'Order placed',
      }],
    });

    try {
      await order.save(); // safe — Order pre-save hook is now pure async (no next())
    } catch (saveErr) {
      if (saveErr?.code === 11000 && saveErr?.keyPattern?.stripePaymentIntentId) {
        const existingOrder = await Order.findOne({ stripePaymentIntentId }).populate('items.product', 'name');
        if (existingOrder) {
          return successResponse(res, 200, 'Order already created for this payment', { order: existingOrder });
        }
      }
      throw saveErr;
    }

    await safeCommit(session);

    // ── 6. Populate & send response ───────────────────────────────────────────
    const populatedOrder = await Order.findById(order._id).populate('items.product', 'name');

    setImmediate(async () => {
      try {
        const tpl = templates.orderConfirmation(populatedOrder, user);
        await sendEmail({ to: user.email, ...tpl });
        await new Notification({
          recipient: user._id, type: 'order_confirmed',
          subject: tpl.subject, body: `Order ${order.orderNumber} confirmed`,
          status: 'sent', sentAt: new Date(),
        }).save();
      } catch (emailErr) {
        logger.warn('Order confirmation email failed:', emailErr.message);
      }
    });

    return successResponse(res, 201, 'Order placed successfully', { order: populatedOrder });
  } catch (err) {
    await safeAbort(session);
    logger.error(`Create order error [${err.name}]: ${err.message}`, { stack: err.stack });
    return handleError(res, err);
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images price mainCategory subCategory itemCategory')
      .populate('items.measurementTemplateId', 'name garmentType measurements notes customer')
      .populate('items.measurementSlotId', 'dateTime status garmentType notes')
      .populate('items.returnRequest.reviewedBy', 'name email')
      .populate('stitchingDetails.measurementTemplate', 'name garmentType measurements notes customer')
      .populate('stitchingDetails.measurementSlot', 'dateTime status garmentType notes')
      .populate('assignedTailor', 'name email')
      .populate('couponApplied.couponId', 'code');

    if (!order) return errorResponse(res, 404, 'Order not found');

    // Customers can only view their own orders
    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Access denied');
    }
    sanitizeOrderMeasurementOwnership(order);
    return successResponse(res, 200, 'Order fetched', { order: normalizeOrderForResponse(order) });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note, deliveryDate, pickupDate, cancellationCharge } = req.body;
    const validStatuses = ['received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) return errorResponse(res, 400, 'Invalid status');

    if (deliveryDate && isPastDate(deliveryDate)) {
      return errorResponse(res, 400, 'Delivery date cannot be in the past');
    }
    if (pickupDate && isPastDate(pickupDate)) {
      return errorResponse(res, 400, 'Pickup date cannot be in the past');
    }

    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    if (!order) return errorResponse(res, 404, 'Order not found');

    if (['delivered', 'cancelled'].includes(order.status)) {
      return errorResponse(res, 400, `Status cannot be changed after ${order.status}`);
    }

    const scheduleParts = [];
    if (deliveryDate) scheduleParts.push(`delivery date ${new Date(deliveryDate).toLocaleDateString('en-IN')}`);
    if (pickupDate) scheduleParts.push(`pickup date ${new Date(pickupDate).toLocaleDateString('en-IN')}`);
    const historyNote = [note?.trim(), ...scheduleParts].filter(Boolean).join(' | ') || undefined;

    order.status = status;
    if (deliveryDate) order.deliveryDate = deliveryDate;
    if (pickupDate) order.pickupDate = pickupDate;
    if (status === 'delivered') order.paymentStatus = 'paid';
    if (status === 'cancelled') {
      const normalizedCancellationCharge = Number(cancellationCharge ?? 0);
      if (Number.isNaN(normalizedCancellationCharge) || normalizedCancellationCharge < 0) {
        return errorResponse(res, 400, 'Cancellation charge must be a non-negative number');
      }
      order.cancellationCharge = normalizedCancellationCharge;
      if (normalizedCancellationCharge > 0) order.paymentStatus = 'paid';
    }

    const latestHistory = order.statusHistory[order.statusHistory.length - 1];
    if (latestHistory && latestHistory.status === status) {
      latestHistory.note = historyNote || latestHistory.note;
      latestHistory.updatedBy = req.user._id;
      latestHistory.updatedAt = new Date();
    } else {
      order.statusHistory.push({ status, note: historyNote, updatedBy: req.user._id });
    }

    await order.save();

    // Send email
    try {
      const tpl = templates.orderStatusUpdate(order, order.customer);
      await sendEmail({ to: order.customer.email, ...tpl });
      const scheduleParts = [];
      if (order.deliveryDate) scheduleParts.push(`delivery date ${new Date(order.deliveryDate).toLocaleDateString('en-IN')}`);
      if (order.pickupDate) scheduleParts.push(`pickup date ${new Date(order.pickupDate).toLocaleDateString('en-IN')}`);
      await new Notification({
        recipient: order.customer._id,
        type: 'order_status_change',
        subject: tpl.subject,
        body: `Order ${order.orderNumber} status changed to ${status}${scheduleParts.length ? ` with ${scheduleParts.join(' and ')}` : ''}`,
        status: 'sent',
        sentAt: new Date(),
      }).save();
    } catch (e) {
      logger.warn('Status update email failed:', e.message);
    }

    return successResponse(res, 200, 'Order status updated', { order });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/orders/:id/assign-tailor
const assignTailor = async (req, res) => {
  try {
    const { tailorId, tailorNote, stitchingCost } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return errorResponse(res, 404, 'Order not found');

    // Business rule: Tailor can only be assigned if there is at least one custom tailoring item
    const hasCustomItems = (order.items || []).some((item) => item.isStitching === true);
    if (!hasCustomItems) {
      return errorResponse(res, 400, 'Tailor can only be assigned to orders containing at least one custom tailoring item');
    }

    const tailor = await User.findOne({ _id: tailorId, role: 'tailor', isActive: true });
    if (!tailor) return errorResponse(res, 404, 'Tailor not found');

    const normalizedStitchingCost = Number(stitchingCost ?? 0);
    if (Number.isNaN(normalizedStitchingCost) || normalizedStitchingCost < 0) {
      return errorResponse(res, 400, 'Stitching cost must be a non-negative number');
    }

    order.assignedTailor = tailorId;
    order.tailorNote = tailorNote;
    order.stitchingCost = normalizedStitchingCost;

    await order.save();
    
    // Populate for response
    await order.populate('assignedTailor', 'name email');
    
    return successResponse(res, 200, 'Tailor assigned', { order });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/orders/:id/items/:itemId/measurement
const assignMeasurementToOrderItem = async (req, res) => {
  try {
    const { templateId } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return errorResponse(res, 404, 'Order not found');

    const item = order.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 404, 'Order item not found');
    if (!item.isStitching) return errorResponse(res, 400, 'Measurement can only be assigned to custom stitching items');

    if (!templateId) {
      item.measurementTemplateId = undefined;
      await order.save();
    } else {
      const template = await MeasurementTemplate.findOne({ _id: templateId, customer: order.customer });
      if (!template) return errorResponse(res, 404, 'Measurement template not found for this customer');

      item.measurementTemplateId = template._id;
      item.garmentType = template.garmentType || item.garmentType;
      await order.save();
    }

    const updatedOrder = await Order.findById(req.params.id)
      .populate('items.measurementTemplateId', 'name garmentType measurements notes')
      .populate('items.product', 'productName name images price')
      .populate('customer', 'name email phone');

    return successResponse(res, 200, 'Measurement assignment updated', { order: updatedOrder });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/orders/:id/items/:itemId/return-request
const requestItemReturn = async (req, res) => {
  try {
    const { reason, refundReceiveMethod, upiId, bankAccountNumber, bankIfscCode } = req.body;

    if (!RETURN_REASONS.includes(reason)) {
      return errorResponse(res, 400, 'Invalid return reason');
    }

    if (!RETURN_REFUND_RECEIVE_METHODS.includes(refundReceiveMethod)) {
      return errorResponse(res, 400, 'Invalid refund receive method');
    }

    const normalizedUpiId = typeof upiId === 'string' ? upiId.trim() : '';
    const normalizedAccount = typeof bankAccountNumber === 'string' ? bankAccountNumber.trim() : '';
    const normalizedIfsc = typeof bankIfscCode === 'string' ? bankIfscCode.trim().toUpperCase() : '';

    if (refundReceiveMethod === 'upi_id') {
      const upiRegex = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/;
      if (!normalizedUpiId || !upiRegex.test(normalizedUpiId)) {
        return errorResponse(res, 400, 'Please enter a valid UPI ID');
      }
    }

    if (refundReceiveMethod === 'bank_account') {
      const accountRegex = /^[0-9]{9,18}$/;
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!normalizedAccount || !accountRegex.test(normalizedAccount)) {
        return errorResponse(res, 400, 'Please enter a valid account number');
      }
      if (!normalizedIfsc || !ifscRegex.test(normalizedIfsc)) {
        return errorResponse(res, 400, 'Please enter a valid IFSC code');
      }
    }

    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('items.product', 'productName name mainCategory subCategory itemCategory');
    if (!order) return errorResponse(res, 404, 'Order not found');

    if (req.user.role === 'customer' && String(order.customer._id) !== String(req.user._id)) {
      return errorResponse(res, 403, 'Access denied');
    }

    const item = order.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 404, 'Order item not found');

    const returnMeta = getReturnEligibilityMeta(order, item);
    if (!returnMeta.canRequest) {
      return errorResponse(res, 400, returnMeta.reason || 'This item is not eligible for return');
    }

    // FINAL VALIDATION: ensure order is still delivered before saving
    if (order.status !== 'delivered') {
      return errorResponse(res, 400, 'Can only request returns on delivered orders');
    }

    item.returnRequest = {
      reason,
      status: 'requested',
      requestedAt: new Date(),
      refundReceiveMethod,
      upiId: refundReceiveMethod === 'upi_id' ? normalizedUpiId : '',
      bankAccountNumber: refundReceiveMethod === 'bank_account' ? normalizedAccount : '',
      bankIfscCode: refundReceiveMethod === 'bank_account' ? normalizedIfsc : '',
    };

    order.statusHistory.push({
      status: order.status,
      note: `Return requested for item ${getOrderItemDisplayName(item)} (${reason})`,
      updatedBy: req.user._id,
    });

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images price mainCategory subCategory itemCategory')
      .populate('items.returnRequest.reviewedBy', 'name email')
      .populate('assignedTailor', 'name email');

    return successResponse(res, 200, 'Return request submitted successfully', {
      order: normalizeOrderForResponse(updatedOrder),
      item,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/orders/returns
const getReturnRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const rawSearch = String(req.query.search || '').trim();

    // Only show return requests on delivered orders.
    // Do not over-constrain nested fields at query-time because legacy records may
    // have partial returnRequest payloads; we filter real requests in-memory below.
    const filter = { status: 'delivered' };
    if (statusFilter) {
      filter['items.returnRequest.status'] = statusFilter;
    }

    if (rawSearch) {
      const regex = escapeRegex(rawSearch);
      const customerMatches = await User.find({
        $or: [
          { name: { $regex: regex, $options: 'i' } },
          { email: { $regex: regex, $options: 'i' } },
        ],
      }).select('_id').lean();

      const customerIds = customerMatches.map((entry) => entry._id);
      filter.$or = [
        { orderNumber: { $regex: regex, $options: 'i' } },
      ];
      if (customerIds.length > 0) {
        filter.$or.push({ customer: { $in: customerIds } });
      }
    }

    const orders = await Order.find(filter)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images mainCategory subCategory')
      .populate('items.returnRequest.reviewedBy', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    const requests = [];
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const request = item?.returnRequest;
        if (!hasRealReturnRequest(item)) return;
        if (statusFilter && request.status !== statusFilter) return;

        requests.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          customer: order.customer,
          item: {
            _id: item._id,
            qty: item.qty,
            price: item.price,
            product: item.product,
            returnRequest: request,
          },
        });
      });
    });

    requests.sort((a, b) => {
      const aTs = new Date(a.item.returnRequest?.requestedAt || a.createdAt || 0).getTime();
      const bTs = new Date(b.item.returnRequest?.requestedAt || b.createdAt || 0).getTime();
      return bTs - aTs;
    });

    const total = requests.length;
    const skip = (page - 1) * limit;
    const paginated = requests.slice(skip, skip + limit);
    return paginatedResponse(res, paginated, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/orders/:id/items/:itemId/return-request
const reviewItemReturnRequest = async (req, res) => {
  try {
    const { status, adminNote, refundAmount, pickupDate } = req.body;
    const allowedStatuses = ['approved', 'processing', 'rejected', 'refunded'];
    if (!allowedStatuses.includes(status)) {
      return errorResponse(res, 400, 'Invalid return status update');
    }

    // Validate pickupDate if provided and status is approved
    if (status === 'approved' && pickupDate) {
      const pickup = new Date(pickupDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (pickup < now) {
        return errorResponse(res, 400, 'Pickup date cannot be in the past');
      }
    }

    const order = await Order.findById(req.params.id)
      .populate('items.product', 'productName name mainCategory subCategory itemCategory');
    if (!order) return errorResponse(res, 404, 'Order not found');

    const item = order.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 404, 'Order item not found');
    if (!hasRealReturnRequest(item)) return errorResponse(res, 400, 'No return request found for this item');
    if (item.returnRequest.status === 'refunded') {
      return errorResponse(res, 400, 'This return request is already refunded');
    }

    if (status === 'refunded') {
      const maxRefund = Number(item.price || 0) * Number(item.qty || 0);
      const normalizedRefund = Number(refundAmount ?? maxRefund);
      if (Number.isNaN(normalizedRefund) || normalizedRefund < 0 || normalizedRefund > maxRefund) {
        return errorResponse(res, 400, `Refund amount must be between 0 and ${maxRefund}`);
      }

      const stockRestored = await restoreReturnedItemStock(item);
      if (!stockRestored) {
        return errorResponse(res, 400, 'Unable to restore stock for returned item');
      }

      item.returnRequest.refundAmount = normalizedRefund;
      if (normalizedRefund > 0) {
        order.paymentStatus = 'refunded';
      }
    }

    item.returnRequest.status = status;
    item.returnRequest.reviewedAt = new Date();
    item.returnRequest.reviewedBy = req.user._id;
    item.returnRequest.adminNote = typeof adminNote === 'string' ? adminNote.trim().slice(0, 500) : '';

    // Set pickup date only when approving
    if (status === 'approved' && pickupDate) {
      item.returnRequest.pickupDate = new Date(pickupDate);
    }

    order.statusHistory.push({
      status: order.status,
      note: `Return ${status} for item ${getOrderItemDisplayName(item)}`,
      updatedBy: req.user._id,
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images price mainCategory subCategory itemCategory')
      .populate('items.returnRequest.reviewedBy', 'name email')
      .populate('assignedTailor', 'name email');

    // Notify customer on return status change (non-blocking)
    try {
      const customer = populatedOrder?.customer;
      const updatedItem = populatedOrder?.items?.id(req.params.itemId)
        || populatedOrder?.items?.find((i) => String(i?._id) === String(req.params.itemId));

      if (customer?.email && updatedItem?.returnRequest?.status) {
        const tpl = templates.returnStatusUpdate({
          order: populatedOrder,
          user: customer,
          itemName: getOrderItemDisplayName(updatedItem),
          returnRequest: updatedItem.returnRequest,
        });
        await sendEmail({ to: customer.email, ...tpl });
      }
    } catch (mailErr) {
      logger.warn(`Return status email failed: ${mailErr.message}`);
    }

    return successResponse(res, 200, 'Return request updated', { order: normalizeOrderForResponse(populatedOrder) });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/orders/:id/items/:itemId/return-request
const cancelItemReturnRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images price mainCategory subCategory itemCategory');
    if (!order) return errorResponse(res, 404, 'Order not found');

    // Customers can only cancel their own return requests
    if (req.user.role === 'customer' && String(order.customer._id) !== String(req.user._id)) {
      return errorResponse(res, 403, 'Access denied');
    }

    const item = order.items.id(req.params.itemId);
    if (!item) return errorResponse(res, 404, 'Order item not found');
    if (!hasRealReturnRequest(item)) return errorResponse(res, 400, 'No return request found for this item');

    // Only allow cancelling if return is still in 'requested' status
    if (item.returnRequest.status !== 'requested') {
      return errorResponse(res, 400, `Cannot cancel return request with status '${item.returnRequest.status}'`);
    }

    // Remove the return request
    item.returnRequest = undefined;

    order.statusHistory.push({
      status: order.status,
      note: `Return request cancelled for item ${getOrderItemDisplayName(item)}`,
      updatedBy: req.user._id,
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name images price mainCategory subCategory itemCategory')
      .populate('assignedTailor', 'name email');

    return successResponse(res, 200, 'Return request cancelled successfully', { order: normalizeOrderForResponse(populatedOrder) });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/orders
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.tailor) filter.assignedTailor = req.query.tailor;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const rawSearch = String(req.query.search).trim();
      if (rawSearch) {
        const regex = escapeRegex(rawSearch);
        const customerMatches = await User.find({
          $or: [
            { name: { $regex: regex, $options: 'i' } },
            { email: { $regex: regex, $options: 'i' } },
          ],
        }).select('_id').lean();

        const customerIds = customerMatches.map((u) => u._id);
        const searchOr = [
          { orderNumber: { $regex: regex, $options: 'i' } },
          { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex, options: 'i' } } },
        ];

        if (customerIds.length) {
          searchOr.push({ customer: { $in: customerIds } });
        }

        filter.$or = searchOr;
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email phone')
        .populate('assignedTailor', 'name')
        .populate('items.product', 'productName name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    return paginatedResponse(res, orders, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/orders/:id/invoice
const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'productName itemCategory')
      .populate('customer', 'name email phone');
    if (!order) return errorResponse(res, 404, 'Order not found');

    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Access denied');
    }

    const pdfBuffer = await generateInvoicePDF(order, order.customer);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/orders/export
const exportOrdersCSV = async (req, res) => {
  try {
    const filter = {};
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }
    if (req.query.status) filter.status = req.query.status;

    const orders = await Order.find(filter)
      .populate('customer', 'name email phone')
      .populate('items.product', 'productName name')
      .sort({ createdAt: -1 })
      .limit(5000);

    const headerOrigin = req.get('origin');
    const headerReferer = req.get('referer');
    let refererOrigin = '';
    try {
      if (headerReferer) refererOrigin = new URL(headerReferer).origin;
    } catch (_) {
      refererOrigin = '';
    }

    const frontendBaseUrl = (
      process.env.FRONTEND_URL
      || headerOrigin
      || refererOrigin
      || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    const header = 'Order No,Date,Customer,Email,Phone,Total,Status,Payment,Items\n';
    const rows = orders.map((o) => {
      const items = o.items.map((i) => {
        const itemName = i?.product?.productName || i?.product?.name || 'Item';
        return `${itemName} x${i.qty}`;
      }).join(' | ');
      const orderUrl = `${frontendBaseUrl}/admin/orders/${o._id}`;
      const orderNoCell = `"=HYPERLINK(""${orderUrl}"",""${o.orderNumber}"")"`;
      return `${orderNoCell},${new Date(o.createdAt).toLocaleDateString()},${o.customer?.name || ''},${o.customer?.email || ''},${o.customer?.phone || ''},${o.totalAmount},${o.status},${o.paymentMethod},"${items}"`;
    });
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=orders-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/tailor/orders
const getTailorOrders = async (req, res) => {
  try {
    const filter = { assignedTailor: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const rawSearch = String(req.query.search || '').trim();
    if (rawSearch) {
      const normalizedSearch = rawSearch.replace(/^#+/, '').trim();
      const effectiveSearch = normalizedSearch || rawSearch;
      const searchRegex = new RegExp(escapeRegex(effectiveSearch), 'i');
      const phonePattern = buildPhoneSearchPattern(effectiveSearch);
      const numericSearch = Number(effectiveSearch);
      const hasNumericSearch = Number.isFinite(numericSearch);

      const customerOr = [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { phone: { $regex: searchRegex } },
      ];
      if (phonePattern) customerOr.push({ phone: { $regex: phonePattern, $options: 'i' } });

      const [matchedCustomers, matchedProducts] = await Promise.all([
        User.find({ $or: customerOr }).select('_id').lean(),
        Product.find({
          $or: [
            { productName: { $regex: searchRegex } },
            { name: { $regex: searchRegex } },
            { itemCategory: { $regex: searchRegex } },
            { subCategory: { $regex: searchRegex } },
            { mainCategory: { $regex: searchRegex } },
          ],
        }).select('_id').lean(),
      ]);
      const matchedCustomerIds = matchedCustomers.map((c) => c._id);
      const matchedProductIds = matchedProducts.map((p) => p._id);

      const searchOr = [
        { orderNumber: { $regex: searchRegex } },
        { 'items.productName': { $regex: searchRegex } },
        { 'items.name': { $regex: searchRegex } },
        { 'items.garmentType': { $regex: searchRegex } },
        { 'items.product': { $in: matchedProductIds } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: escapeRegex(effectiveSearch),
              options: 'i',
            },
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: { $ifNull: ['$stitchingCost', ''] } },
              regex: escapeRegex(effectiveSearch),
              options: 'i',
            },
          },
        },
      ];

      if (matchedCustomerIds.length) {
        searchOr.push({ customer: { $in: matchedCustomerIds } });
      }

      if (hasNumericSearch) {
        searchOr.push({ stitchingCost: numericSearch });
      }

      if (mongoose.Types.ObjectId.isValid(effectiveSearch)) {
        searchOr.push({ _id: effectiveSearch });
      }

      filter.$or = searchOr;
    }

    const orders = await Order.find(filter)
      .populate('customer', 'name phone')
      .populate('items.product', 'productName name images')
      .populate('items.measurementTemplateId', 'name garmentType measurements notes')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Assigned orders', { orders });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/tailor/orders/:id/status
const updateTailorOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['tailoring', 'processing', 'ready'];
    if (!validStatuses.includes(status)) return errorResponse(res, 400, 'Invalid status for tailor');

    const order = await Order.findOne({ _id: req.params.id, assignedTailor: req.user._id });
    if (!order) return errorResponse(res, 404, 'Order not found or not assigned to you');

    if (['delivered', 'cancelled'].includes(order.status)) {
      return errorResponse(res, 400, `Status cannot be changed after ${order.status}`);
    }

    order.status = status;
    order.statusHistory.push({ status, note, updatedBy: req.user._id });
    await order.save();
    return successResponse(res, 200, 'Status updated', { order });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/orders/offline
const createOfflineOrder = async (req, res) => {
  try {
    const {
      customer,
      items,
      shippingAddress,
      paymentMethod = 'COD',
      paymentStatus = 'paid',
      status = 'delivered',
      isPickup = true,
      notes,
    } = req.body;

    if (!customer?.name?.trim()) {
      return errorResponse(res, 400, 'Customer name is required');
    }
    if (!customer?.email?.trim() && !customer?.phone?.trim()) {
      return errorResponse(res, 400, 'Customer email or phone is required');
    }
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'At least one order item is required');
    }

    const normalizedEmail = customer.email?.trim().toLowerCase();
    const normalizedPhone = customer.phone?.trim();

    let customerUser = null;
    let shouldSendAccountAccessEmail = false;
    if (normalizedEmail) {
      customerUser = await User.findOne({ email: normalizedEmail });
      if (customerUser && customerUser.role !== 'customer') {
        return errorResponse(res, 400, 'This email is linked to a non-customer account');
      }
    }
    if (!customerUser && normalizedPhone) {
      customerUser = await User.findOne({ phone: normalizedPhone, role: 'customer' });
    }

    if (!customerUser) {
      const fallbackEmail = normalizedEmail || `offline-${Date.now()}@wellfit.local`;
      const randomPassword = crypto.randomBytes(16).toString('hex');

      customerUser = await User.create({
        name: customer.name.trim(),
        email: fallbackEmail,
        phone: normalizedPhone,
        passwordHash: randomPassword,
        role: 'customer',
        isActive: !!normalizedEmail,
      });
      shouldSendAccountAccessEmail = !!normalizedEmail;
    } else {
      const updates = {};
      if (customer.name?.trim() && customer.name.trim() !== customerUser.name) updates.name = customer.name.trim();
      if (normalizedPhone && normalizedPhone !== customerUser.phone) updates.phone = normalizedPhone;
      if (normalizedEmail && normalizedEmail !== customerUser.email) updates.email = normalizedEmail;
      if (normalizedEmail && !customerUser.isActive) updates.isActive = true;
      if (normalizedEmail && (!customerUser.isActive || !customerUser.lastLogin)) {
        shouldSendAccountAccessEmail = true;
      }

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(customerUser._id, updates);
        customerUser = await User.findById(customerUser._id);
      }
    }

    let subtotal = 0;
    const normalizedItems = [];

    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (!item.product || qty <= 0) {
        return errorResponse(res, 400, 'Each item must include product and qty > 0');
      }

      const product = await Product.findById(item.product);
      if (!product) return errorResponse(res, 400, 'One or more products are invalid');

      let price = Number(item.price);
      if (Number.isNaN(price) || price < 0) price = Number(product.price || 0);

      const normalizedItem = {
        product: product._id,
        qty,
        price,
        isStitching: !!item.isStitching,
        note: typeof item.note === 'string' ? item.note.trim().slice(0, 500) : undefined,
      };

      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) return errorResponse(res, 400, `Variant not found for ${product.name}`);
        if (variant.stock < qty) return errorResponse(res, 400, `Insufficient stock for ${product.name}`);

        normalizedItem.variantId = variant._id;
        normalizedItem.variantDetails = {
          size: variant.size,
          color: variant.color,
          fabric: variant.fabric,
        };

        if (Number.isNaN(Number(item.price)) || Number(item.price) < 0) {
          if (variant.price != null && !Number.isNaN(Number(variant.price))) {
            normalizedItem.price = Number(variant.price);
          } else {
            normalizedItem.price = Number(product.price || 0) + Number(variant.additionalPrice || 0);
          }
        }

        await Product.findOneAndUpdate(
          { _id: product._id, 'variants._id': variant._id },
          { $inc: { 'variants.$.stock': -qty, totalStock: -qty, soldCount: qty } }
        );
      }

      subtotal += normalizedItem.price * qty;
      normalizedItems.push(normalizedItem);
    }

    const validStatuses = ['received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled'];
    const validPaymentMethods = ['COD', 'UPI', 'credit_card', 'debit_card', 'razorpay'];
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

    if (!validStatuses.includes(status)) return errorResponse(res, 400, 'Invalid order status');
    if (!validPaymentMethods.includes(paymentMethod)) return errorResponse(res, 400, 'Invalid payment method');
    if (!validPaymentStatuses.includes(paymentStatus)) return errorResponse(res, 400, 'Invalid payment status');

    const addr = {
      label: shippingAddress?.label?.trim() || 'Home',
      name: shippingAddress?.name?.trim() || customer.name.trim(),
      phone: shippingAddress?.phone?.trim() || normalizedPhone || '',
      line1: shippingAddress?.line1?.trim() || 'Offline Shop Counter',
      line2: shippingAddress?.line2?.trim() || '',
      city: shippingAddress?.city?.trim() || 'N/A',
      state: shippingAddress?.state?.trim() || 'N/A',
      pincode: shippingAddress?.pincode?.trim() || '000000',
      country: shippingAddress?.country?.trim() || 'India',
    };

    const order = await Order.create({
      customer: customerUser._id,
      items: normalizedItems,
      shippingAddress: addr,
      subtotal,
      discountAmount: 0,
      totalAmount: subtotal,
      status,
      paymentMethod,
      paymentStatus,
      isPickup,
      notes,
      isOfflineSale: true,
      statusHistory: [{
        status,
        note: 'Offline order created by admin',
        updatedBy: req.user._id,
      }],
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'name');

    if (shouldSendAccountAccessEmail && normalizedEmail) {
      setImmediate(async () => {
        try {
          const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          await sendEmail({
            to: normalizedEmail,
            subject: 'Your Wellfit account is ready',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#FFF2E1;padding:20px;border-radius:8px;">
                <h2 style="color:#A79277;">Account Access Enabled</h2>
                <p>Hello ${customerUser.name},</p>
                <p>Your in-store purchase has been linked to your Wellfit online account.</p>
                <p>To access your account and view order details, use the <strong>Forgot Password</strong> option on login to set a new password.</p>
                <p><a href="${appUrl}/login" style="color:#2F2621;">Go to Login</a></p>
              </div>
            `,
            text: `Your Wellfit account is ready. Open ${appUrl}/login and use Forgot Password to set your password.`,
          });
        } catch (emailErr) {
          logger.warn('Offline account access email failed:', emailErr.message);
        }
      });
    }

    return successResponse(res, 201, 'Offline order created successfully', { order: populatedOrder });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  createOrder,
  getOrderById,
  requestItemReturn,
  getReturnRequests,
  reviewItemReturnRequest,
  cancelItemReturnRequest,
  updateOrderStatus,
  assignTailor,
  assignMeasurementToOrderItem,
  getAllOrders,
  downloadInvoice,
  exportOrdersCSV,
  getTailorOrders,
  updateTailorOrderStatus,
  createOfflineOrder,
};
