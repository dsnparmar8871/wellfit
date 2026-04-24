const Category = require('../models/Category');
const { successResponse, errorResponse, handleError } = require('../utils/apiResponse');
const { buildCategoryStructureFromDB } = require('../utils/categories');
const { escapeRegex } = require('../utils/common');

const buildBaseSlug = (name = '') => String(name)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');


const getUniqueSlug = async (name, excludeId = null) => {
  const baseSlug = buildBaseSlug(name) || 'category';
  const slugRegex = new RegExp(`^${escapeRegex(baseSlug)}(?:-(\\d+))?$`, 'i');
  const filter = { slug: { $regex: slugRegex } };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await Category.find(filter).select('slug').lean();
  if (!existing.length) return baseSlug;

  const usedNumbers = new Set(
    existing
      .map((doc) => {
        const match = doc.slug.match(new RegExp(`^${escapeRegex(baseSlug)}-(\\d+)$`, 'i'));
        return match ? Number(match[1]) : 0;
      })
      .filter((num) => !Number.isNaN(num))
  );

  let suffix = 1;
  while (usedNumbers.has(suffix)) suffix += 1;
  return `${baseSlug}-${suffix}`;
};

const normalizeParentCategory = (parentCategory) => {
  if (parentCategory === undefined || parentCategory === null) return null;
  const value = String(parentCategory).trim();
  if (!value || value === 'null' || value === 'undefined') return null;
  return value;
};

// Helper to sync category structure after modifications
const syncCategoryStructure = async () => {
  try {
    const allCategories = await Category.find({ isActive: true })
      .populate('parentCategory', '_id name slug')
      .lean();
    buildCategoryStructureFromDB(allCategories);
  } catch (err) {
    console.warn('Failed to sync category structure:', err.message);
  }
};

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.query.parent) filter.parentCategory = req.query.parent === 'null' ? null : req.query.parent;
    if (req.query.active !== 'false') filter.isActive = true;

    const categories = await Category.find(filter)
      .populate('parentCategory', '_id name slug')
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    
    // Update category structure from database (full sync on unfiltered queries)
    if (!req.query.parent) {
      const allCategories = await Category.find({ isActive: true })
        .populate('parentCategory', '_id name slug')
        .lean();
      buildCategoryStructureFromDB(allCategories);
    }
    
    return successResponse(res, 200, 'Categories fetched', { categories });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/categories/:id
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate('parentCategory', 'name slug');
    if (!category) return errorResponse(res, 404, 'Category not found');
    // Also fetch subcategories
    const subcategories = await Category.find({ parentCategory: category._id, isActive: true });
    return successResponse(res, 200, 'Category fetched', { category, subcategories });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/admin/categories
const createCategory = async (req, res) => {
  try {
    const { name, parentCategory, description, sortOrder } = req.body;
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return errorResponse(res, 400, 'Category name is required');

    const normalizedParent = normalizeParentCategory(parentCategory);
    if (normalizedParent) {
      if (!Category.db.base.Types.ObjectId.isValid(normalizedParent)) {
        return errorResponse(res, 400, 'Invalid parent category');
      }
      const parentExists = await Category.findById(normalizedParent).select('_id').lean();
      if (!parentExists) return errorResponse(res, 404, 'Parent category not found');
    }

    const image = req.file ? req.file.location || `/uploads/${req.file.filename}` : req.body.image;
    const slug = await getUniqueSlug(trimmedName);
    const normalizedSortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;

    const category = new Category({
      name: trimmedName,
      slug,
      parentCategory: normalizedParent,
      image,
      description: description || undefined,
      sortOrder: normalizedSortOrder,
    });
    await category.save();
    
    // Sync category structure
    await syncCategoryStructure();
    
    return successResponse(res, 201, 'Category created', { category });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/admin/categories/:id
const updateCategory = async (req, res) => {
  try {
    const { name, parentCategory, description, isActive, sortOrder } = req.body;
    const image = req.file ? req.file.location || `/uploads/${req.file.filename}` : undefined;

    const update = {};

    if (name !== undefined) {
      const trimmedName = String(name || '').trim();
      if (!trimmedName) return errorResponse(res, 400, 'Category name is required');
      update.name = trimmedName;
      update.slug = await getUniqueSlug(trimmedName, req.params.id);
    }

    if (parentCategory !== undefined) {
      const normalizedParent = normalizeParentCategory(parentCategory);
      if (normalizedParent) {
        if (!Category.db.base.Types.ObjectId.isValid(normalizedParent)) {
          return errorResponse(res, 400, 'Invalid parent category');
        }
        if (normalizedParent === String(req.params.id)) {
          return errorResponse(res, 400, 'Category cannot be its own parent');
        }
        const parentExists = await Category.findById(normalizedParent).select('_id').lean();
        if (!parentExists) return errorResponse(res, 404, 'Parent category not found');
        update.parentCategory = normalizedParent;
      } else {
        update.parentCategory = null;
      }
    }

    if (description !== undefined) update.description = description;
    if (isActive !== undefined) update.isActive = isActive;
    if (sortOrder !== undefined) {
      update.sortOrder = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
    }
    if (image) update.image = image;

    const category = await Category.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!category) return errorResponse(res, 404, 'Category not found');
    
    // Sync category structure
    await syncCategoryStructure();
    
    return successResponse(res, 200, 'Category updated', { category });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/admin/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) return errorResponse(res, 404, 'Category not found');
    
    // Sync category structure
    await syncCategoryStructure();
    
    return successResponse(res, 200, 'Category deactivated');
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
