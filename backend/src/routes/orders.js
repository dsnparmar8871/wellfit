const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  createOrder, getOrderById, updateOrderStatus, assignTailor,
  requestItemReturn, getReturnRequests, reviewItemReturnRequest,
    cancelItemReturnRequest,
  assignMeasurementToOrderItem,
  getAllOrders, downloadInvoice, exportOrdersCSV,
  getTailorOrders, updateTailorOrderStatus, createOfflineOrder,
} = require('../controllers/orderController');

// ── POST: place order ─────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  [
    body('items').isArray({ min: 1 }).withMessage('Items are required'),
    body('shippingAddress.line1').notEmpty().withMessage('Address line1 required'),
    body('shippingAddress.city').notEmpty().withMessage('City required'),
    body('shippingAddress.state').notEmpty().withMessage('State required'),
    body('shippingAddress.pincode').notEmpty().withMessage('Pincode required'),
    body('paymentMethod')
      .isIn(['COD', 'UPI', 'credit_card', 'debit_card', 'razorpay'])
      .withMessage('Invalid payment method'),
  ],
  validate,
  createOrder
);

// ── STATIC paths MUST come before /:id wildcard ───────────────────────────────

// Admin: list + export (defined before /:id so "export" isn't treated as an ID)
router.get('/', authenticate, authorize('admin'), getAllOrders);
router.get('/export/csv', authenticate, authorize('admin'), exportOrdersCSV);
router.get('/returns', authenticate, authorize('admin'), getReturnRequests);
router.post(
  '/offline',
  authenticate,
  authorize('admin'),
  [
    body('customer.name').notEmpty().withMessage('Customer name is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('paymentMethod').optional().isIn(['COD', 'UPI', 'credit_card', 'debit_card', 'razorpay']),
    body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
    body('status').optional().isIn(['received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled']),
  ],
  validate,
  createOfflineOrder
);

// Customer shortcuts
router.get('/my', authenticate, (req, res) => {
  require('../controllers/userController').getMyOrders(req, res);
});

// Tailor static routes
router.get('/tailor/assigned', authenticate, authorize('tailor'), getTailorOrders);
router.patch('/tailor/:id/status', authenticate, authorize('tailor'), updateTailorOrderStatus);

// ── Dynamic /:id routes AFTER all static paths ────────────────────────────────
router.get('/:id', authenticate, getOrderById);
router.get('/:id/invoice', authenticate, downloadInvoice);

// Admin: update order (also after static paths to avoid conflicts)
router.patch('/:id/status', authenticate, authorize('admin'), updateOrderStatus);
router.patch('/:id/assign-tailor', authenticate, authorize('admin'), assignTailor);
router.patch('/:id/items/:itemId/measurement', authenticate, authorize('admin'), assignMeasurementToOrderItem);
router.patch('/:id/items/:itemId/return-request', authenticate, authorize('admin'), reviewItemReturnRequest);
router.post(
  '/:id/items/:itemId/return-request',
  authenticate,
  [
    body('reason')
      .isIn(['size_issue', 'wrong_item', 'defective', 'not_as_described', 'changed_mind', 'other'])
      .withMessage('Invalid return reason'),
    body('refundReceiveMethod')
      .isIn(['upi_id', 'bank_account', 'collect_from_shop'])
      .withMessage('Invalid refund receive method'),
    body('upiId')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('UPI ID is invalid'),
    body('bankAccountNumber')
      .optional()
      .isString()
      .isLength({ max: 40 })
      .withMessage('Bank account number is invalid'),
    body('bankIfscCode')
      .optional()
      .isString()
      .isLength({ max: 20 })
      .withMessage('IFSC code is invalid'),
  ],
  validate,
  requestItemReturn
);

router.delete(
  '/:id/items/:itemId/return-request',
  authenticate,
  cancelItemReturnRequest
);

module.exports = router;
