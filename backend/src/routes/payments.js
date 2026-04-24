const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createPaymentIntent, verifyPayment, stripeWebhook } = require('../controllers/paymentController');

router.post('/create-intent', authenticate, createPaymentIntent);
router.post('/verify', authenticate, verifyPayment);

// Webhook - raw body needed
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

module.exports = router;
