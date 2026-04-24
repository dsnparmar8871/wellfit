const TailorBill = require('../models/TailorBill');
const Order = require('../models/Order');
const User = require('../models/User');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const { generateTailorBillPDF } = require('../utils/pdfGenerator');
const mongoose = require('mongoose');
const { escapeRegex, buildPhoneSearchPattern } = require('../utils/common');


const normalizeTailorBillPaymentStatus = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'done') return 'Done';
  if (normalized === 'pending') return 'Pending';
  return '';
};

// GET /api/tailor/stats
const getTailorStats = async (req, res) => {
  try {
    const tailorId = req.user._id;
    const [total, pending, processing, done] = await Promise.all([
      Order.countDocuments({ assignedTailor: tailorId }),
      Order.countDocuments({ assignedTailor: tailorId, status: 'received' }),
      Order.countDocuments({ assignedTailor: tailorId, status: { $in: ['tailoring', 'processing'] } }),
      Order.countDocuments({ assignedTailor: tailorId, status: 'ready' }),
    ]);

    const completedOrders = await Order.find({
      assignedTailor: tailorId,
      status: { $in: ['ready', 'delivered'] },
    }).select('stitchingCost');

    const stitchingRevenue = completedOrders.reduce((sum, o) => sum + (o.stitchingCost || 0), 0);

    return successResponse(res, 200, 'Tailor stats', {
      total, pending, processing, done, stitchingRevenue,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/tailor/bills - Generate bill (only DELIVERED orders)
const generateBill = async (req, res) => {
  try {
    const { orderIds, notes } = req.body;
    if (!orderIds || orderIds.length === 0) return errorResponse(res, 400, 'Select at least one order');

    const normalizedOrderIds = orderIds
      .map((id) => {
        if (typeof id === 'string') return id;
        if (id && typeof id === 'object') return id._id || id.id || null;
        return null;
      })
      .filter(Boolean)
      .map((id) => String(id).trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (normalizedOrderIds.length === 0) {
      return errorResponse(res, 400, 'Invalid order selection');
    }

    // Prevent duplicate payment requests for orders already accepted/paid.
    const existingBillsWithOrders = await TailorBill.find({
      orders: { $in: normalizedOrderIds },
      status: { $in: ['accepted', 'paid'] },
    }).select('orders status billNumber');
    
    const usedOrderIds = new Set(existingBillsWithOrders.flatMap((b) => b.orders.map((o) => String(o))));
    const conflictingOrders = normalizedOrderIds.filter((id) => usedOrderIds.has(id));
    
    if (conflictingOrders.length > 0) {
      return errorResponse(res, 400, 'Some orders are already included in accepted/paid bills');
    }

    const orders = await Order.find({
      _id: { $in: normalizedOrderIds },
      assignedTailor: req.user._id,
      status: 'delivered', // ONLY delivered orders
    });

    if (orders.length === 0) return errorResponse(res, 400, 'No valid delivered orders found');
    if (orders.length < normalizedOrderIds.length) return errorResponse(res, 400, 'Some selected orders are not delivered');

    const totalAmount = orders.reduce((sum, o) => sum + (o.stitchingCost || 0), 0);
    const bill = new TailorBill({
      tailor: req.user._id,
      orders: orders.map((o) => o._id),
      totalAmount,
      notes,
      requestDate: new Date(),
    });
    await bill.save();
    return successResponse(res, 201, 'Bill generated', { bill });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/tailor/bills/:id/pdf
const downloadTailorBillPDF = async (req, res) => {
  try {
    const bill = await TailorBill.findOne({ _id: req.params.id, tailor: req.user._id })
      .populate('tailor', 'name email phone')
      .populate('orders', 'orderNumber stitchingCost status createdAt');

    if (!bill) return errorResponse(res, 404, 'Bill not found');
    if (bill.status === 'pending') return errorResponse(res, 400, 'PDF available after admin accepts the bill');

    const pdfBuffer = await generateTailorBillPDF(bill);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="tailor-bill-${bill.billNumber || bill._id}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/tailor/bills
const getMyBills = async (req, res) => {
  try {
    const filter = { tailor: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) {
      const normalizedPaymentStatus = normalizeTailorBillPaymentStatus(req.query.paymentStatus);
      if (!normalizedPaymentStatus) return errorResponse(res, 400, 'Invalid payment status');
      filter.paymentStatus = normalizedPaymentStatus;
    }

    const rawSearch = String(req.query.search || '').trim();
    if (rawSearch) {
      const searchRegex = new RegExp(escapeRegex(rawSearch), 'i');
      const matchedOrders = await Order.find({ orderNumber: { $regex: searchRegex } }).select('_id').lean();
      const matchedOrderIds = matchedOrders.map((o) => o._id);

      const searchOr = [{ billNumber: { $regex: searchRegex } }];
      if (matchedOrderIds.length) searchOr.push({ orders: { $in: matchedOrderIds } });
      if (mongoose.Types.ObjectId.isValid(rawSearch)) searchOr.push({ _id: rawSearch });
      filter.$or = searchOr;
    }

    const bills = await TailorBill.find(filter)
      .populate('orders', 'orderNumber status stitchingCost')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Tailor bills', { bills });
  } catch (err) {
    return handleError(res, err);
  }
};

// ---- Admin ----

// GET /api/admin/bills
const getAllBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) {
      const normalizedPaymentStatus = normalizeTailorBillPaymentStatus(req.query.paymentStatus);
      if (!normalizedPaymentStatus) return errorResponse(res, 400, 'Invalid payment status');
      filter.paymentStatus = normalizedPaymentStatus;
    }
    if (req.query.tailor) filter.tailor = req.query.tailor;
    if (req.query.search) {
      const rawSearch = String(req.query.search).trim();
      if (rawSearch) {
        const searchRegex = new RegExp(escapeRegex(rawSearch), 'i');
        const phonePattern = buildPhoneSearchPattern(rawSearch);

        const tailorFilterOr = [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
        ];
        if (phonePattern) tailorFilterOr.push({ phone: { $regex: phonePattern, $options: 'i' } });

        const [tailorMatches, orderMatches] = await Promise.all([
          User.find({ role: 'tailor', $or: tailorFilterOr }).select('_id').lean(),
          Order.find({ orderNumber: { $regex: searchRegex } }).select('_id').lean(),
        ]);

        const tailorIds = tailorMatches.map((t) => t._id);
        const orderIds = orderMatches.map((o) => o._id);

        const searchOr = [{ billNumber: { $regex: searchRegex } }];
        if (tailorIds.length) searchOr.push({ tailor: { $in: tailorIds } });
        if (orderIds.length) searchOr.push({ orders: { $in: orderIds } });
        filter.$or = searchOr;
      }
    }

    const [bills, total] = await Promise.all([
      TailorBill.find(filter)
        .populate('tailor', 'name email phone')
        .populate('orders', 'orderNumber status stitchingCost')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TailorBill.countDocuments(filter),
    ]);
    return paginatedResponse(res, bills, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/bills/:id/accept
const acceptBill = async (req, res) => {
  try {
    const { collectionDate } = req.body;
    if (!collectionDate) return errorResponse(res, 400, 'Collection date is required');
    
    const bill = await TailorBill.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'accepted',
        collectionDate: new Date(collectionDate),
      },
      { new: true }
    ).populate('tailor', 'name email phone').populate('orders', 'orderNumber');
    
    if (!bill) return errorResponse(res, 404, 'Bill not found');
    return successResponse(res, 200, 'Bill accepted', { bill });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/bills/:id/payment-status
const updatePaymentStatus = async (req, res) => {
  try {
    const paymentStatus = normalizeTailorBillPaymentStatus(req.body?.paymentStatus);
    if (!paymentStatus) {
      return errorResponse(res, 400, 'Invalid payment status');
    }
    
    // Check if bill exists and get current status
    const bill = await TailorBill.findById(req.params.id);
    if (!bill) return errorResponse(res, 404, 'Bill not found');
    
    // Prevent updates if status is already Done
    if (normalizeTailorBillPaymentStatus(bill.paymentStatus) === 'Done') {
      return errorResponse(res, 400, 'This bill\'s payment status is already finalized and cannot be changed');
    }
    
    const updateData = { paymentStatus };
    if (paymentStatus === 'Done') {
      updateData.paymentCompletedAt = new Date();
      updateData.status = 'paid';
    }
    
    const updatedBill = await TailorBill.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('tailor', 'name email phone').populate('orders', 'orderNumber stitchingCost');
    
    return successResponse(res, 200, 'Payment status updated', { bill: updatedBill });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/bills/export/csv
const exportBillsCSV = async (req, res) => {
  try {
    const bills = await TailorBill.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'tailor',
          foreignField: '_id',
          as: 'tailorDoc',
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orders',
          foreignField: '_id',
          as: 'orderDocs',
        },
      },
      {
        $addFields: {
          tailorDoc: { $arrayElemAt: ['$tailorDoc', 0] },
          orderNumbers: {
            $map: {
              input: { $ifNull: ['$orderDocs', []] },
              as: 'ord',
              in: { $ifNull: ['$$ord.orderNumber', { $toString: '$$ord._id' }] },
            },
          },
          requestedAt: { $ifNull: ['$requestDate', '$createdAt'] },
        },
      },
      {
        $project: {
          _id: 0,
          billNumber: 1,
          requestedAt: 1,
          collectionDate: 1,
          totalAmount: 1,
          paymentStatus: 1,
          paymentCompletedAt: 1,
          orderNumbers: 1,
          tailorName: '$tailorDoc.name',
          tailorEmail: '$tailorDoc.email',
        },
      },
    ]);

    const formatDate = (value, includeTime = false) => {
      if (!value) return 'N/A';
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return 'N/A';
      if (includeTime) {
        return dt.toISOString().replace('T', ' ').slice(0, 19);
      }
      return dt.toISOString().slice(0, 10);
    };

    const csvEscape = (value) => {
      const str = String(value ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const header = [
      'Bill Number',
      'Tailor Name',
      'Tailor Email',
      'Request Date',
      'Collection Date',
      'Total Amount',
      'Payment Status',
      'Payment Completed At',
      'Orders Included',
    ].join(',');

    const rows = bills.map((bill) => ([
      bill.billNumber || '',
      bill.tailorName || '',
      bill.tailorEmail || '',
      formatDate(bill.requestedAt),
      formatDate(bill.collectionDate),
      bill.totalAmount ?? 0,
      bill.paymentStatus || 'Pending',
      formatDate(bill.paymentCompletedAt, true),
      (bill.orderNumbers || []).join(' | ') || 'N/A',
    ].map(csvEscape).join(',')));

    const csv = `${header}\n${rows.join('\n')}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tailor_bills_registry.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/tailors
const getAllTailors = async (req, res) => {
  try {
    const filter = { role: 'tailor' };
    const rawSearch = String(req.query.search || '').trim();

    if (rawSearch) {
      const safeSearch = escapeRegex(rawSearch);
      const searchOr = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
      const phonePattern = buildPhoneSearchPattern(rawSearch);
      if (phonePattern) {
        searchOr.push({ phone: { $regex: phonePattern, $options: 'i' } });
      }
      filter.$or = searchOr;
    }

    const tailors = await User.find(filter)
      .select('name email phone isActive createdAt')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Tailors list', { tailors });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/bills/:id/pdf
const downloadAdminBillPDF = async (req, res) => {
  try {
    const bill = await TailorBill.findById(req.params.id)
      .populate('tailor', 'name email phone')
      .populate('orders', 'orderNumber stitchingCost status createdAt');

    if (!bill) return errorResponse(res, 404, 'Bill not found');
    if (bill.status === 'pending') return errorResponse(res, 400, 'PDF available after bill is accepted');

    const pdfBuffer = await generateTailorBillPDF(bill);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="tailor-bill-${bill.billNumber || bill._id}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  getTailorStats,
  generateBill,
  getMyBills,
  downloadTailorBillPDF,
  getAllBills,
  acceptBill,
  updatePaymentStatus,
  exportBillsCSV,
  getAllTailors,
  downloadAdminBillPDF,
};
