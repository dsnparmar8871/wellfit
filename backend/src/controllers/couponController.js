const Coupon = require('../models/Coupon');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');

// POST /api/coupons/validate
const validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return errorResponse(res, 404, 'Coupon not found');

    const validity = coupon.isValid(orderAmount, req.user._id);
    if (!validity.valid) return errorResponse(res, 400, validity.message);

    const discountAmount = coupon.calculateDiscount(orderAmount);
    return successResponse(res, 200, 'Coupon is valid', {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount: orderAmount - discountAmount,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/coupons/available
const getAvailableCoupons = async (req, res) => {
  try {
    const orderAmount = Number(req.query.orderAmount || 0);
    const userId = req.user?._id?.toString();

    const coupons = await Coupon.find({
      isActive: true,
      expiry: { $gte: new Date() },
    })
      .sort({ expiry: 1, createdAt: -1 })
      .select('code description discountType discountValue minOrder maxDiscount perUserLimit usageLimit usedCount expiry usedBy');

    const availableCoupons = coupons
      .map((coupon) => {
        const userUsageCount = coupon.usedBy.filter((id) => id.toString() === userId).length;
        const usageLeft = coupon.usageLimit == null ? null : Math.max(0, coupon.usageLimit - coupon.usedCount);

        const isUsageAvailable = coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit;
        const isUserEligible = userUsageCount < coupon.perUserLimit;
        const meetsMinOrder = orderAmount >= Number(coupon.minOrder || 0);

        return {
          code: coupon.code,
          description: coupon.description || '',
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrder: coupon.minOrder || 0,
          maxDiscount: coupon.maxDiscount || null,
          expiry: coupon.expiry,
          usageLeft,
          isApplicable: isUsageAvailable && isUserEligible && meetsMinOrder,
        };
      })
      .filter((coupon) => coupon.usageLeft === null || coupon.usageLeft > 0);

    return successResponse(res, 200, 'Available coupons fetched', { coupons: availableCoupons });
  } catch (err) {
    return handleError(res, err);
  }
};

// ---- Admin CRUD ----
// GET /api/admin/coupons
const getAllCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    if (req.query.discountType) filter.discountType = req.query.discountType;
    if (req.query.search) {
      const rawSearch = String(req.query.search).trim();
      if (rawSearch) {
        filter.code = { $regex: rawSearch, $options: 'i' };
      }
    }
    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(filter),
    ]);
    return paginatedResponse(res, coupons, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/admin/coupons
const createCoupon = async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    return successResponse(res, 201, 'Coupon created', { coupon });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/admin/coupons/:id
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!coupon) return errorResponse(res, 404, 'Coupon not found');
    return successResponse(res, 200, 'Coupon updated', { coupon });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/admin/coupons/:id
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!coupon) return errorResponse(res, 404, 'Coupon not found');
    return successResponse(res, 200, 'Coupon deactivated');
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { validateCoupon, getAvailableCoupons, getAllCoupons, createCoupon, updateCoupon, deleteCoupon };
