const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const { escapeRegex, buildPhoneSearchPattern } = require('../utils/common');

const recalculateProductRating = async (productId) => {
  const allReviews = await Review.find({ product: productId });
  const avg = allReviews.length
    ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
    : 0;

  await Product.findByIdAndUpdate(productId, {
    avgRating: Math.round(avg * 10) / 10,
    totalReviews: allReviews.length,
  });
};

const buildProductReviewFilter = async (productId, query = {}) => {
  const filter = { product: productId };

  if (query.approved === 'true') filter.isApproved = true;
  if (query.approved === 'false') filter.isApproved = false;

  if (query.pinned === 'true') filter.isPinned = true;
  if (query.pinned === 'false') filter.isPinned = false;

  if (query.rating) {
    const rating = Number(query.rating);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      filter.rating = rating;
    }
  }

  if (query.search) {
    const escaped = escapeRegex(query.search.trim());
    const regex = new RegExp(escaped, 'i');
    
    // Find matching users by name to search reviews by reviewer
    const matchedUsers = await User.find({ name: regex }).select('_id');
    const userIds = matchedUsers.map(u => u._id);
    
    filter.$or = [
      { comment: regex },
      { customer: { $in: userIds } }
    ];
  }

  return filter;
};

const buildSortForReviews = (sort = '') => {
  if (sort === 'oldest') {
    return { isPinned: -1, createdAt: 1 };
  }
  if (sort === 'highest-rating') {
    return { isPinned: -1, rating: -1, createdAt: -1 };
  }
  if (sort === 'lowest-rating') {
    return { isPinned: -1, rating: 1, createdAt: -1 };
  }
  return { isPinned: -1, pinnedAt: -1, createdAt: -1 };
};

// POST /api/products/:id/reviews
const createReview = async (req, res) => {
  try {
    const { rating, comment, orderId } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, 404, 'Product not found');

    // Check if already reviewed
    const existing = await Review.findOne({ product: req.params.id, customer: req.user._id });
    if (existing) return errorResponse(res, 409, 'You have already reviewed this product');

    // Optionally verify purchase
    if (orderId) {
      const order = await Order.findOne({ _id: orderId, customer: req.user._id, status: 'delivered' });
      if (!order) return errorResponse(res, 400, 'Order not found or not delivered yet');
    }

    const images = req.files ? req.files.map((f) => f.location || `/uploads/${f.filename}`) : [];
    const review = new Review({
      product: req.params.id,
      customer: req.user._id,
      order: orderId,
      rating,
      comment,
      images,
      isApproved: true,
    });
    await review.save();
    await recalculateProductRating(req.params.id);

    return successResponse(res, 201, 'Review submitted successfully.', { review });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/products/:id/reviews
const getProductReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const filter = { product: req.params.id, isApproved: true };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('customer', 'name avatar')
        .sort(buildSortForReviews(req.query.sort))
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);
    return paginatedResponse(res, reviews, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/reviews/:id/approve
const approveReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!review) return errorResponse(res, 404, 'Review not found');

    await recalculateProductRating(review.product);

    return successResponse(res, 200, 'Review approved', { review });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/admin/reviews/:id
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return errorResponse(res, 404, 'Review not found');

    await recalculateProductRating(review.product);

    return successResponse(res, 200, 'Review deleted');
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/reviews
const getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.approved !== undefined) filter.isApproved = req.query.approved === 'true';
    if (req.query.pinned !== undefined) filter.isPinned = req.query.pinned === 'true';

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('customer', 'name email')
        .populate('product', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);
    return paginatedResponse(res, reviews, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/reviews/product/:productId
const getAdminProductReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const filter = await buildProductReviewFilter(req.params.productId, req.query);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('customer', 'name email avatar')
        .populate('pinnedBy', 'name')
        .sort(buildSortForReviews(req.query.sort))
        .skip(skip)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    return paginatedResponse(res, reviews, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/reviews/:id/pin
const setPinnedReview = async (req, res) => {
  try {
    const shouldPin = req.body?.isPinned !== false;
    const review = await Review.findById(req.params.id);
    if (!review) return errorResponse(res, 404, 'Review not found');

    if (shouldPin) {
      await Review.updateMany(
        { product: review.product, _id: { $ne: review._id }, isPinned: true },
        { $set: { isPinned: false }, $unset: { pinnedAt: 1, pinnedBy: 1 } }
      );
    }

    review.isPinned = shouldPin;
    review.pinnedAt = shouldPin ? new Date() : undefined;
    review.pinnedBy = shouldPin ? req.user._id : undefined;
    await review.save();

    return successResponse(res, 200, shouldPin ? 'Review pinned' : 'Review unpinned', { review });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/reviews/customer/:id
const deleteCustomerReview = async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, customer: req.user._id });
    if (!review) return errorResponse(res, 404, 'Review not found or unauthorized');

    const productId = review.product;
    await Review.findByIdAndDelete(req.params.id);
    await recalculateProductRating(productId);

    return successResponse(res, 200, 'Review removed successfully');
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  approveReview,
  deleteReview,
  getAllReviews,
  getAdminProductReviews,
  setPinnedReview,
  deleteCustomerReview,
};
