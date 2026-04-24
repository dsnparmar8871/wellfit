const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getCategories, getCategoryById,
  createCategory, updateCategory, deleteCategory,
} = require('../controllers/categoryController');

// Public
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Admin only
router.post('/', authenticate, authorize('admin'), upload.single('image'), createCategory);
router.put('/:id', authenticate, authorize('admin'), upload.single('image'), updateCategory);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

module.exports = router;
