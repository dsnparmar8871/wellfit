const Product = require('../models/Product');
const { successResponse, errorResponse, paginatedResponse, handleError } = require('../utils/apiResponse');
const fs = require('fs');
const { deleteFromCloudinary } = require('../config/cloudinary');
const {
  CATEGORY_STRUCTURE,
  MAIN_CATEGORIES,
  SUB_CATEGORIES,
  ITEM_CATEGORIES,
  isValidCategoryPath,
  getItemCategories,
  normalizeCategoryToken,
  toComparableCategoryToken,
  findCanonicalOption,
} = require('../utils/categories');
const { escapeRegex, buildPhoneSearchPattern } = require('../utils/common');

const parseMaybeArray = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return parsed != null ? [parsed] : [];
  } catch (_) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
};

const parseVariants = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};



const normalizeCategoryPayload = (data) => {
  if (!data.mainCategory && data.category) data.mainCategory = data.category;
  if (!data.subCategory && data.subcategory) data.subCategory = data.subcategory;
  if (data.mainCategory !== undefined) data.mainCategory = normalizeCategoryToken(data.mainCategory);
  if (data.subCategory !== undefined) data.subCategory = normalizeCategoryToken(data.subCategory);
  if (data.itemCategory !== undefined) data.itemCategory = normalizeCategoryToken(data.itemCategory);
  if (data.mainCategory === 'Accessories') data.subCategory = '';
};

const extractImageUrl = (file) => file.path || file.location || `/uploads/${file.filename}`;

const cleanupUploadedFiles = (files = []) => {
  files.forEach((file) => {
    if (file?.path) {
      fs.unlink(file.path, () => { });
    }
    if (file?.filename) {
      deleteFromCloudinary(file.filename).catch(() => { });
    }
  });
};

const normalizeProductPayload = (body, files) => {
  const data = { ...body };
  if (!data.productName && data.name) data.productName = data.name;

  if (data.isFeatured !== undefined) {
    if (typeof data.isFeatured === 'string') {
      data.isFeatured = data.isFeatured.toLowerCase() === 'true';
    } else {
      data.isFeatured = !!data.isFeatured;
    }
  }

  normalizeCategoryPayload(data);

  if (data.price !== undefined) data.price = Number(data.price);
  if (data.mrp !== undefined) data.mrp = Number(data.mrp);

  const basePrice = Number.isNaN(Number(data.price)) ? 0 : Number(data.price);
  const baseMrpRaw = Number(data.mrp);
  const baseMrp = Number.isNaN(baseMrpRaw) ? basePrice : baseMrpRaw;

  data.tags = parseMaybeArray(data.tags);
  data.relatedProducts = parseMaybeArray(data.relatedProducts);
  data.recommendedAccessories = parseMaybeArray(data.recommendedAccessories);

  const variantImageMap = new Map();
  const genericImages = [];
  (files || []).forEach((file) => {
    if (/^variantImage_\d+$/.test(file.fieldname)) {
      const index = parseInt(file.fieldname.split('_')[1], 10);
      if (!Number.isNaN(index)) variantImageMap.set(index, extractImageUrl(file));
      return;
    }
    if (file.fieldname === 'images') genericImages.push(extractImageUrl(file));
  });

  const variants = parseVariants(data.variants).map((variant, index) => {
    const parsedVariantPrice = Number(variant.price);
    const parsedVariantMrp = Number(variant.mrp);
    const variantPrice = Number.isNaN(parsedVariantPrice) ? basePrice : parsedVariantPrice;
    const variantMrpCandidate = Number.isNaN(parsedVariantMrp) ? baseMrp : parsedVariantMrp;
    const variantMrp = variantMrpCandidate < variantPrice ? variantPrice : variantMrpCandidate;

    return {
      size: variant.size || '',
      color: variant.color || 'Unspecified',
      stock: Number(variant.stock) || 0,
      image: variantImageMap.get(index) || variant.image || '',
      price: variantPrice,
      mrp: variantMrp,
    };
  });

  if (data.variants !== undefined || variantImageMap.size > 0) data.variants = variants;

  // Handle extra images (generic images)
  const existingExtraImages = parseMaybeArray(data.images);
  data.images = [...existingExtraImages, ...genericImages];

  if (data.mainCategory && data.itemCategory) {
    const itemOptions = getItemCategories(data.mainCategory, data.subCategory || '');
    const canonicalItem = findCanonicalOption(itemOptions, data.itemCategory);
    if (canonicalItem) data.itemCategory = canonicalItem;

    const matchesAllowedOptions = itemOptions.some(
      (option) => toComparableCategoryToken(option) === toComparableCategoryToken(data.itemCategory)
    );
    const matchesPath = isValidCategoryPath(data.mainCategory, data.subCategory || '', data.itemCategory);

    if (!matchesAllowedOptions && !matchesPath) {
      const categoryError = new Error('Invalid category combination');
      categoryError.statusCode = 400;
      throw categoryError;
    }
  }

  delete data.name;
  delete data.category;
  delete data.subcategory;

  return data;
};

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      mainCategory,
      category,
      subCategory,
      subcategory,
      itemCategory,
      search,
      minPrice,
      maxPrice,
      size,
      color,
      sort = '-createdAt',
      featured,
      inStock,
    } = req.query;

    const filter = { isActive: true };
    const selectedMainCategory = mainCategory || category;
    const selectedSubCategory = subCategory || subcategory;
    if (selectedMainCategory) filter.mainCategory = selectedMainCategory;
    if (selectedSubCategory) filter.subCategory = selectedSubCategory;
    if (itemCategory) filter.itemCategory = itemCategory;

    if (featured === 'true') filter.isFeatured = true;
    if (inStock === 'true') filter.totalStock = { $gt: 0 };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (size) filter['variants.size'] = size;
    if (color) filter['variants.color'] = { $regex: color, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    if (sort.startsWith('-')) sortObj[sort.slice(1)] = -1;
    else sortObj[sort] = 1;

    // If search is present, show matching products first followed by others.
    // If NO products match the search, show nothing (to trigger "product not found" UI).
    if (search) {
      const safeSearch = escapeRegex(search);
      const regex = new RegExp(safeSearch, 'i');
      const searchFilter = {
        $or: [{ productName: regex }, { description: regex }, { itemCategory: regex }],
      };

      const matchExists = await Product.exists({ ...filter, ...searchFilter });
      if (!matchExists) {
        return paginatedResponse(res, [], page, limit, 0);
      }

      const [products, total] = await Promise.all([
        Product.aggregate([
          { $match: filter },
          {
            $addFields: {
              searchScore: {
                $add: [
                  {
                    $cond: [
                      { $regexMatch: { input: '$productName', regex: safeSearch, options: 'i' } },
                      10,
                      0,
                    ],
                  },
                  {
                    $cond: [
                      { $regexMatch: { input: '$description', regex: safeSearch, options: 'i' } },
                      5,
                      0,
                    ],
                  },
                  {
                    $cond: [
                      { $regexMatch: { input: '$itemCategory', regex: safeSearch, options: 'i' } },
                      1,
                      0,
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { searchScore: -1, ...sortObj } },
          { $skip: skip },
          { $limit: parseInt(limit) },
          { $project: { ratings: 0 } },
        ]),
        Product.countDocuments(filter),
      ]);

      return paginatedResponse(res, products, page, limit, total);
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('-ratings')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);

    return paginatedResponse(res, products, page, limit, total);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('relatedProducts', 'productName images price mrp slug')
      .populate('recommendedAccessories', 'productName images price mrp slug');

    if (!product || !product.isActive) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product fetched', { product });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/products/slug/:slug
const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('relatedProducts', 'productName images price mrp slug')
      .populate('recommendedAccessories', 'productName images price mrp slug');

    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product fetched', { product });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/admin/products
const createProduct = async (req, res) => {
  try {
    const data = normalizeProductPayload(req.body, req.files);

    const product = new Product(data);
    await product.save();
    return successResponse(res, 201, 'Product created', { product });
  } catch (err) {
    cleanupUploadedFiles(req.files);
    return handleError(res, err);
  }
};

// PUT /api/admin/products/:id
const updateProduct = async (req, res) => {
  try {
    const data = normalizeProductPayload(req.body, req.files);

    const product = await Product.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product updated', { product });
  } catch (err) {
    cleanupUploadedFiles(req.files);
    return handleError(res, err);
  }
};

// DELETE /api/admin/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product deactivated');
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/admin/products/low-stock
const getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;
    const products = await Product.find({ isActive: true, totalStock: { $lte: threshold } })
      .sort({ totalStock: 1 });
    return successResponse(res, 200, 'Low stock products', { products, threshold });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/products/category-structure
const getCategoryStructure = async (_req, res) => {
  return successResponse(res, 200, 'Product category structure', {
    categoryStructure: CATEGORY_STRUCTURE,
    mainCategories: MAIN_CATEGORIES,
    subCategories: SUB_CATEGORIES,
    itemCategories: ITEM_CATEGORIES,
  });
};

// PATCH /api/admin/products/:id/variant/:variantId/stock
const updateVariantStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return errorResponse(res, 404, 'Product not found');
    const variant = product.variants.id(req.params.variantId);
    if (!variant) return errorResponse(res, 404, 'Variant not found');
    variant.stock = parseInt(stock);
    product.totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    await product.save();
    return successResponse(res, 200, 'Stock updated', { product });
  } catch (err) {
    return handleError(res, err);
  }
};

const normalizePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMapById = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    if (item?._id) map.set(String(item._id), item);
  });
  return map;
};

const uniqueById = (items = []) => {
  const map = toMapById(items);
  return Array.from(map.values());
};

const mergeUniqueProducts = (...groups) => uniqueById(groups.flat().filter(Boolean));

const getProductSuggestions = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true })
      .populate('relatedProducts', 'productName images price mrp slug itemCategory mainCategory subCategory totalStock isActive variants isStitchingAvailable')
      .populate('recommendedAccessories', 'productName images price mrp slug itemCategory mainCategory subCategory totalStock isActive variants isStitchingAvailable');

    if (!product) return errorResponse(res, 404, 'Product not found');

    const productId = String(product._id);
    const isAccessoryProduct = product.mainCategory === 'Accessories';
    const curatedRelated = (product.relatedProducts || []).filter((item) => item?.isActive !== false && String(item._id) !== productId);
    const curatedAccessories = (product.recommendedAccessories || []).filter((item) => {
      if (item?.isActive === false || String(item._id) === productId) return false;
      if (isAccessoryProduct) return item?.mainCategory === 'Clothes';
      return true;
    });

    const relatedFallback = await Product.find({
      _id: { $ne: product._id },
      isActive: true,
      mainCategory: product.mainCategory,
      itemCategory: product.itemCategory,
    })
      .select('productName images price mrp slug itemCategory mainCategory subCategory totalStock variants isStitchingAvailable')
      .sort({ soldCount: -1, avgRating: -1, createdAt: -1 })
      .limit(8);

    const secondaryRelatedFallback = await Product.find({
      _id: { $ne: product._id },
      isActive: true,
      mainCategory: product.mainCategory,
      subCategory: product.subCategory,
    })
      .select('productName images price mrp slug itemCategory mainCategory subCategory totalStock variants isStitchingAvailable')
      .sort({ soldCount: -1, avgRating: -1, createdAt: -1 })
      .limit(8);

    const accessoryFallbackFilter = {
      _id: { $ne: product._id },
      isActive: true,
      ...(isAccessoryProduct
        ? { mainCategory: 'Clothes' }
        : { mainCategory: 'Accessories' }),
    };

    const accessoryFallback = await Product.find(accessoryFallbackFilter)
      .select('productName images price mrp slug itemCategory mainCategory subCategory totalStock variants isStitchingAvailable')
      .sort({ soldCount: -1, avgRating: -1, createdAt: -1 })
      .limit(8);

    const relatedProducts = mergeUniqueProducts(curatedRelated, relatedFallback, secondaryRelatedFallback).slice(0, 6);
    const accessories = mergeUniqueProducts(curatedAccessories, accessoryFallback).slice(0, 6);

    const comboSeedProducts = relatedProducts.length > 0 ? relatedProducts.slice(0, 3) : [product];
    const comboAccessories = accessories.slice(0, 3);

    const combos = comboSeedProducts
      .flatMap((baseProduct, index) => {
        const accessory = comboAccessories[index % comboAccessories.length];
        if (!accessory) return [];

        const basePrice = normalizePrice(baseProduct.price);
        const baseMrp = Math.max(basePrice, normalizePrice(baseProduct.mrp));
        const accessoryPrice = normalizePrice(accessory.price);
        const accessoryMrp = Math.max(accessoryPrice, normalizePrice(accessory.mrp));
        const comboPrice = basePrice + accessoryPrice;
        const comboMrp = baseMrp + accessoryMrp;

        return [{
          label: `${baseProduct.productName || 'Item'} + ${accessory.productName || 'Accessory'}`,
          products: [baseProduct, accessory],
          comboPrice,
          comboMrp,
          savings: Math.max(0, comboMrp - comboPrice),
        }];
      })
      .slice(0, 3);

    return successResponse(res, 200, 'Product suggestions fetched', {
      relatedProducts,
      accessories,
      combos,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  updateVariantStock,
  getCategoryStructure,
  getProductSuggestions,
};
