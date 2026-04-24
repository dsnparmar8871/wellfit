const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats, getSalesReport, getTopProducts, getOrdersOverTime,
} = require('../controllers/analyticsController');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesReport);
router.get('/top-products', getTopProducts);
router.get('/orders-over-time', getOrdersOverTime);

module.exports = router;
