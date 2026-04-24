const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  validateCoupon, getAvailableCoupons, getAllCoupons, createCoupon, updateCoupon, deleteCoupon,
} = require('../controllers/couponController');

// Customer - validate coupon
router.post(
  '/validate',
  authenticate,
  [
    body('code').notEmpty().withMessage('Coupon code required'),
    body('orderAmount').isNumeric().withMessage('Order amount required'),
  ],
  validate,
  validateCoupon
);

// Customer - get available coupons for checkout
router.get('/available', authenticate, getAvailableCoupons);

// Admin CRUD
router.get('/', authenticate, authorize('admin'), getAllCoupons);
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('code').notEmpty().trim().withMessage('Coupon code required'),
    body('discountType').isIn(['percentage', 'flat']).withMessage('Invalid discount type'),
    body('discountValue').isNumeric().withMessage('Discount value required'),
    body('expiry').isISO8601().withMessage('Valid expiry date required'),
  ],
  validate,
  createCoupon
);
router.put('/:id', authenticate, authorize('admin'), updateCoupon);
router.delete('/:id', authenticate, authorize('admin'), deleteCoupon);

module.exports = router;
