const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
	approveReview,
	deleteReview,
	getAllReviews,
	getAdminProductReviews,
	setPinnedReview,
	deleteCustomerReview,
} = require('../controllers/reviewController');

// Admin
router.get('/', authenticate, authorize('admin'), getAllReviews);
router.get('/product/:productId', authenticate, authorize('admin'), getAdminProductReviews);
router.patch('/:id/approve', authenticate, authorize('admin'), approveReview);
router.patch('/:id/pin', authenticate, authorize('admin'), setPinnedReview);
router.delete('/:id', authenticate, authorize('admin'), deleteReview);

// Customer
router.delete('/customer/:id', authenticate, deleteCustomerReview);

module.exports = router;
