const User = require('../models/User');
const Order = require('../models/Order');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const { escapeRegex, buildPhoneSearchPattern } = require('../utils/common');

const buildUserSearchOr = (search = '') => {
  const safeSearch = escapeRegex(search);
  const or = [
    { name: { $regex: safeSearch, $options: 'i' } },
    { email: { $regex: safeSearch, $options: 'i' } },
    { phone: { $regex: safeSearch, $options: 'i' } },
  ];

  const phonePattern = buildPhoneSearchPattern(search);
  if (phonePattern) {
    or.push({ phone: { $regex: phonePattern, $options: 'i' } });
  }

  return or;
};

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, 200, 'Profile fetched', { user });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, phone, avatar } },
      { new: true, runValidators: true }
    );
    return successResponse(res, 200, 'Profile updated', { user });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/users/addresses
const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    user.addresses.push(req.body);
    await user.save();
    return successResponse(res, 201, 'Address added', { addresses: user.addresses });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/users/addresses/:addressId
const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return errorResponse(res, 404, 'Address not found');
    if (req.body.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }
    Object.assign(addr, req.body);
    await user.save();
    return successResponse(res, 200, 'Address updated', { addresses: user.addresses });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/users/addresses/:addressId
const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses = user.addresses.filter(
      (a) => a._id.toString() !== req.params.addressId
    );
    await user.save();
    return successResponse(res, 200, 'Address removed', { addresses: user.addresses });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/users/orders
const getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { customer: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    filter.$nor = [
      {
        paymentMethod: { $in: ['UPI', 'credit_card', 'debit_card', 'stripe'] },
        paymentStatus: 'pending',
      },
    ];

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('items.product', 'productName name images price mainCategory subCategory itemCategory')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return paginatedResponse(res, orders, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// ---- Admin: manage users ----
// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      const rawSearch = String(req.query.search).trim();
      if (rawSearch) {
        filter.$or = buildUserSearchOr(rawSearch);
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return paginatedResponse(res, users, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 404, 'User not found');
    const orders = await Order.find({ customer: req.params.id })
      .select('orderNumber status totalAmount createdAt notes items stitchingDetails')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'User details', { user, recentOrders: orders });
  } catch (err) {
    return handleError(res, err);
  }
};

// PATCH /api/admin/users/:id/status
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 404, 'User not found');
    user.isActive = !user.isActive;
    await user.save();
    return successResponse(res, 200, `User ${user.isActive ? 'activated' : 'deactivated'}`, { user });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/admin/users/create-tailor
const createTailor = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 409, 'Email already registered');

    const tailor = new User({ name, email, phone, passwordHash: password, role: 'tailor' });
    await tailor.save();
    return successResponse(res, 201, 'Tailor account created', { user: tailor });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 404, 'User not found');
    if (user.role === 'admin') return errorResponse(res, 400, 'Admin accounts cannot be deleted');

    await User.findByIdAndDelete(req.params.id);
    return successResponse(res, 200, 'User deleted successfully');
  } catch (err) {
    return handleError(res, err);
  }
};
 // GET /api/users/admin/customers
 const getCustomers = async (req, res) => {
   try {
     const MeasurementTemplate = require('../models/MeasurementTemplate');
     const filter = { role: 'customer' };
     if (req.query.search) {
       const rawSearch = String(req.query.search).trim();
       if (rawSearch) {
         filter.$or = buildUserSearchOr(rawSearch);
       }
     }
     const customers = await User.find(filter).sort({ createdAt: -1 }).lean();
     const customersWithCounts = await Promise.all(
       customers.map(async (c) => {
         const [orderCount, measurementCount] = await Promise.all([
           Order.countDocuments({ customer: c._id }),
           MeasurementTemplate.countDocuments({ customer: c._id }),
         ]);
         return { ...c, orderCount, measurementCount };
       })
     );
     return successResponse(res, 200, 'Customers fetched', { customers: customersWithCounts });
   } catch (err) {
     return handleError(res, err);
   }
 };

module.exports = {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  getMyOrders,
  getAllUsers,
  getUserById,
   getCustomers,
  toggleUserStatus,
  createTailor,
  deleteUser,
};
