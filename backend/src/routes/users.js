const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getProfile, updateProfile, addAddress, updateAddress, deleteAddress,
  getMyOrders,
   getAllUsers, getUserById, getCustomers, toggleUserStatus, createTailor, deleteUser,
} = require('../controllers/userController');

// Customer routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/addresses', authenticate, addAddress);
router.put('/addresses/:addressId', authenticate, updateAddress);
router.delete('/addresses/:addressId', authenticate, deleteAddress);
router.get('/my-orders', authenticate, getMyOrders);

// Admin routes
router.get('/admin/users', authenticate, authorize('admin'), getAllUsers);
router.get('/admin/users/:id', authenticate, authorize('admin'), getUserById);
 router.get('/admin/customers', authenticate, authorize('admin'), getCustomers);
router.patch('/admin/users/:id/status', authenticate, authorize('admin'), toggleUserStatus);
router.delete('/admin/users/:id', authenticate, authorize('admin'), deleteUser);
router.post('/admin/users/create-tailor', authenticate, authorize('admin'), createTailor);

module.exports = router;
