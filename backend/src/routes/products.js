const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validateProductPayload } = require('../middleware/productValidation');
const { upload } = require('../config/cloudinary');
const { MAIN_CATEGORIES } = require('../utils/categories');
const {
  getProducts, getProductById, getProductBySlug,
  createProduct, updateProduct, deleteProduct,
  getLowStockProducts, updateVariantStock, getCategoryStructure, getProductSuggestions,
} = require('../controllers/productController');
const { createReview, getProductReviews } = require('../controllers/reviewController');

const validateProductFilters = (req, res, next) => {
  const selectedMainCategory = req.query.mainCategory || req.query.category;
  if (selectedMainCategory && !MAIN_CATEGORIES.includes(selectedMainCategory)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mainCategory filter',
    });
  }
  next();
};

// ── Static paths FIRST (before /:id wildcard) ─────────────────────────────────
router.get('/', optionalAuth, validateProductFilters, getProducts);
router.get('/low-stock', authenticate, authorize('admin'), getLowStockProducts);
router.get('/slug/:slug', optionalAuth, getProductBySlug);
router.get('/category-structure', optionalAuth, getCategoryStructure);
router.get('/:id/suggestions', optionalAuth, getProductSuggestions);

// Admin: create product
router.post('/', authenticate, authorize('admin'), upload.any(), validateProductPayload, createProduct);

// ── Dynamic /:id routes AFTER all static paths ────────────────────────────────
router.get('/:id', optionalAuth, getProductById);
router.get('/:id/reviews', getProductReviews);
router.post('/:id/reviews', authenticate, upload.array('images', 3), createReview);
router.put('/:id', authenticate, authorize('admin'), upload.any(), validateProductPayload, updateProduct);
router.delete('/:id', authenticate, authorize('admin'), deleteProduct);
router.patch('/:id/variant/:variantId/stock', authenticate, authorize('admin'), updateVariantStock);

module.exports = router;
