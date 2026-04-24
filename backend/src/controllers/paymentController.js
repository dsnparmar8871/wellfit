const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getStripe } = require('../config/stripe');
const { successResponse, errorResponse, handleError } = require('../utils/apiResponse');
const { sendEmail, templates } = require('../utils/email');
const logger = require('../utils/logger');

// POST /api/payments/create-intent
const createPaymentIntent = async (req, res) => {
  try {
    const { orderId, amount, paymentMethod } = req.body;

    let order = null;
    let amountInPaise = 0;
    let method = paymentMethod;

    if (orderId) {
      order = await Order.findById(orderId);
      if (!order) return errorResponse(res, 404, 'Order not found');
      if (order.customer.toString() !== req.user._id.toString()) {
        return errorResponse(res, 403, 'Access denied');
      }
      amountInPaise = Math.round(order.totalAmount * 100);
      method = order.paymentMethod;
    } else {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return errorResponse(res, 400, 'Valid amount is required');
      }
      if (!['UPI', 'credit_card', 'debit_card', 'stripe'].includes(method)) {
        return errorResponse(res, 400, 'Invalid prepaid payment method');
      }
      amountInPaise = Math.round(numericAmount * 100);
    }

    const stripe = getStripe();
    if (!stripe) {
      // Simulated mode
      const simulatedIntentId = `pi_sim_${Date.now()}`;
      if (order) {
        order.stripePaymentIntentId = simulatedIntentId;
        await order.save();
      }
      return successResponse(res, 200, 'Simulated Stripe payment intent', {
        id: simulatedIntentId,
        clientSecret: `${simulatedIntentId}_secret_sim_${Date.now()}`,
        amount: amountInPaise,
        currency: 'inr',
        simulated: true,
      });
    }

    const intentParams = {
      amount: amountInPaise, // Stripe expects amount in smallest currency unit
      currency: 'inr',
      metadata: {
        ...(order ? { orderId: order._id.toString(), orderNumber: order.orderNumber } : {}),
        userId: req.user._id.toString(),
      },
    };

    // Respect checkout choice so UPI flow can render UPI-specific UI (including QR when eligible).
    if (method === 'UPI') {
      intentParams.payment_method_types = ['upi'];
    } else if (method === 'credit_card' || method === 'debit_card') {
      intentParams.payment_method_types = ['card'];
    } else {
      intentParams.automatic_payment_methods = { enabled: true };
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    if (order) {
      order.stripePaymentIntentId = paymentIntent.id;
      await order.save();
    }

    return successResponse(res, 200, 'Stripe payment intent created', {
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (err) {
    logger.error('Create payment intent error:', err);
    return handleError(res, err);
  }
};

// POST /api/payments/verify
const verifyPayment = async (req, res) => {
  try {
    const { orderId, stripePaymentIntentId } = req.body;
    if (!orderId || !stripePaymentIntentId) {
      return errorResponse(res, 400, 'orderId and stripePaymentIntentId are required');
    }

    const order = await Order.findById(orderId);
    if (!order) return errorResponse(res, 404, 'Order not found');
    if (order.customer.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Access denied');
    }

    if (order.paymentStatus === 'paid') {
      return successResponse(res, 200, 'Payment already verified', { order });
    }

    const isPrepaidMethod = ['UPI', 'credit_card', 'debit_card', 'stripe'].includes(order.paymentMethod);
    const customer = await User.findById(order.customer).select('_id name email');

    const stripe = getStripe();
    
    // Simulated payment verification
    if (!stripe || stripePaymentIntentId.includes('sim_')) {
      order.paymentStatus = 'paid';
      order.stripePaymentId = `sim_pay_${Date.now()}`;
      order.statusHistory.push({
        status: order.status,
        note: 'Payment verified (simulated)',
        updatedBy: req.user._id,
      });
      await order.save();

      if (isPrepaidMethod && customer?.email) {
        setImmediate(async () => {
          try {
            const populatedOrder = await Order.findById(order._id).populate('items.product', 'name');
            const tpl = templates.orderConfirmation(populatedOrder, customer);
            await sendEmail({ to: customer.email, ...tpl });
            await new Notification({
              recipient: customer._id,
              type: 'order_confirmed',
              subject: tpl.subject,
              body: `Payment successful for order ${order.orderNumber}`,
              status: 'sent',
              sentAt: new Date(),
            }).save();
          } catch (emailErr) {
            logger.warn('Post-payment confirmation email failed:', emailErr.message);
          }
        });
      }

      return successResponse(res, 200, 'Payment verified (simulated)', { order });
    }

    // Real Stripe verification
    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      // Keep order in pending state for async methods (e.g., UPI) until Stripe confirms success.
      if (paymentIntent.status === 'payment_failed' || paymentIntent.status === 'canceled') {
        order.paymentStatus = 'failed';
        await order.save();
      }
      return errorResponse(res, 400, `Payment not completed yet: status is ${paymentIntent.status}`);
    }

    order.paymentStatus = 'paid';
    order.stripePaymentId = paymentIntent.charges.data[0]?.id || paymentIntent.id;
    order.statusHistory.push({
      status: order.status,
      note: 'Payment successful',
      updatedBy: req.user._id,
    });
    await order.save();

    if (isPrepaidMethod && customer?.email) {
      setImmediate(async () => {
        try {
          const populatedOrder = await Order.findById(order._id).populate('items.product', 'name');
          const tpl = templates.orderConfirmation(populatedOrder, customer);
          await sendEmail({ to: customer.email, ...tpl });
          await new Notification({
            recipient: customer._id,
            type: 'order_confirmed',
            subject: tpl.subject,
            body: `Payment successful for order ${order.orderNumber}`,
            status: 'sent',
            sentAt: new Date(),
          }).save();
        } catch (emailErr) {
          logger.warn('Post-payment confirmation email failed:', emailErr.message);
        }
      });
    }

    return successResponse(res, 200, 'Payment verified', { order });
  } catch (err) {
    logger.error('Verify payment error:', err);
    return handleError(res, err);
  }
};

// POST /api/payments/webhook (Stripe webhook)
const stripeWebhook = async (req, res) => {
  try {
    const stripe = getStripe();
    const signature = req.headers['stripe-signature'];
    const body = req.body;

    let event;

    if (stripe && process.env.STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        logger.error('Webhook signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    } else {
      // Simulated mode
      event = JSON.parse(body);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.orderId;
        if (orderId) {
          await Order.findByIdAndUpdate(
            orderId,
            {
              paymentStatus: 'paid',
              stripePaymentId: paymentIntent.charges.data[0]?.id || paymentIntent.id,
            }
          );
        }
        break;
      }
      case 'payment_intent.payment_failed':
      case 'charge.failed': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        await Order.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntentId },
          { paymentStatus: 'failed' }
        );
        break;
      }
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createPaymentIntent, verifyPayment, stripeWebhook };

