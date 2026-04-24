const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { successResponse, errorResponse, handleError } = require('../utils/apiResponse');

const revenueExpr = {
  $add: [
    { $subtract: ['$totalAmount', { $ifNull: ['$stitchingCost', 0] }] },
    { $ifNull: ['$cancellationCharge', 0] },
  ],
};

// GET /api/admin/analytics/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      totalRevenue,
      monthRevenue,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalCustomers,
      newCustomersMonth,
      totalProducts,
      lowStockProducts,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.aggregate([
        { $match: { $or: [{ paymentStatus: 'paid' }, { status: 'cancelled' }] } },
        { $group: { _id: null, total: { $sum: revenueExpr } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, $or: [{ paymentStatus: 'paid' }, { status: 'cancelled' }] } },
        { $group: { _id: null, total: { $sum: revenueExpr } } },
      ]),
      Order.countDocuments({ status: { $in: ['received', 'tailoring', 'processing'] } }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: startOfMonth } }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({
        isActive: true,
        totalStock: { $lte: parseInt(process.env.LOW_STOCK_THRESHOLD) || 5 },
      }),
    ]);

    return successResponse(res, 200, 'Dashboard stats', {
      orders: {
        total: totalOrders,
        today: todayOrders,
        thisMonth: monthOrders,
        pending: pendingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        thisMonth: monthRevenue[0]?.total || 0,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersMonth,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/analytics/sales
const getSalesReport = async (req, res) => {
  try {
    const { period = 'daily', from, to } = req.query;
    const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : new Date();

    let groupFormat;
    if (period === 'daily') groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    else if (period === 'weekly') groupFormat = { $isoWeek: '$createdAt' };
    else groupFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };

    const salesData = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, $or: [{ paymentStatus: 'paid' }, { status: 'cancelled' }] } },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: revenueExpr },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: revenueExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return successResponse(res, 200, 'Sales report', { period, from: start, to: end, data: salesData });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/analytics/top-products
const getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topProducts = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          totalSold: 1,
          totalRevenue: 1,
          'product.productName': 1,
          'product.name': '$product.productName',
          'product.images': 1,
          'product.price': 1,
        },
      },
    ]);

    return successResponse(res, 200, 'Top selling products', { products: topProducts });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/analytics/orders-over-time
const getOrdersOverTime = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: revenueExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return successResponse(res, 200, 'Orders over time', { days, data });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { getDashboardStats, getSalesReport, getTopProducts, getOrdersOverTime };
