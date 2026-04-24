const {
  MAIN_CATEGORIES,
  getSubCategories,
  getItemCategories,
  isValidCategoryPath,
  findCanonicalOption,
} = require('../utils/categories');
const fs = require('fs');
const { deleteFromCloudinary } = require('../config/cloudinary');
const { normalizeCategoryToken, asNumber, toComparableCategoryToken } = require('../utils/common');


const parseVariantsFromBody = (variants) => {
  if (variants == null || variants === '') return [];
  if (Array.isArray(variants)) return variants;

  if (typeof variants === 'string') {
    try {
      const parsed = JSON.parse(variants);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  return [];
};

const isVariantEmpty = (variant = {}) => {
  const size = String(variant.size || '').trim();
  const color = String(variant.color || '').trim();
  const stockRaw = String(variant.stock ?? '').trim();
  const image = String(variant.image || '').trim();
  const stockIsDefault = stockRaw === '' || Number(stockRaw) === 0;
  return !size && !color && stockIsDefault && !image;
};

const cleanupUploadedFiles = (files = []) => {
  files.forEach((file) => {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    if (file?.filename) {
      deleteFromCloudinary(file.filename).catch(() => {});
    }
  });
};

const validateProductPayload = (req, res, next) => {
  const errors = [];

  const productName = String(req.body.productName || req.body.name || '').trim();
  let mainCategory = normalizeCategoryToken(req.body.mainCategory || req.body.category || '');
  let subCategory = normalizeCategoryToken(req.body.subCategory || req.body.subcategory || '');
  let itemCategory = normalizeCategoryToken(req.body.itemCategory || '');
  const price = asNumber(req.body.price);
  const mrp = asNumber(req.body.mrp);

  const variants = parseVariantsFromBody(req.body.variants)
    .filter((variant) => !isVariantEmpty(variant));

  if (!productName) {
    errors.push({ field: 'productName', message: 'Product name is required' });
  }

  mainCategory = findCanonicalOption(MAIN_CATEGORIES, mainCategory) || mainCategory;

  if (!mainCategory) {
    errors.push({ field: 'mainCategory', message: 'Main category is required' });
  } else if (!MAIN_CATEGORIES.includes(mainCategory)) {
    errors.push({ field: 'mainCategory', message: `Main category must be one of: ${MAIN_CATEGORIES.join(', ')}` });
  }

  if (mainCategory === 'Clothes') {
    const validSubCategories = getSubCategories(mainCategory);
    subCategory = findCanonicalOption(validSubCategories, subCategory) || subCategory;
    if (!subCategory) {
      errors.push({ field: 'subCategory', message: 'Sub-category is required when main category is Clothes' });
    } else if (!validSubCategories.includes(subCategory)) {
      errors.push({ field: 'subCategory', message: `Sub-category must be one of: ${validSubCategories.join(', ')}` });
    }
  } else if (mainCategory === 'Accessories') {
    subCategory = '';
  }

  const itemCategoryOptions = getItemCategories(mainCategory, subCategory);
  itemCategory = findCanonicalOption(itemCategoryOptions, itemCategory) || itemCategory;

  if (!itemCategory) {
    errors.push({ field: 'itemCategory', message: 'Item category is required' });
  } else if (mainCategory) {
    const matchesAllowedOptions = itemCategoryOptions.some(
      (option) => toComparableCategoryToken(option) === toComparableCategoryToken(itemCategory)
    );
    const matchesPath = isValidCategoryPath(mainCategory, subCategory, itemCategory);

    if (!matchesAllowedOptions && !matchesPath) {
      const options = itemCategoryOptions;
    const hint = options.length ? `Allowed values: ${options.join(', ')}` : 'Select main/sub category first';
    errors.push({ field: 'itemCategory', message: `Item category does not match selected path. ${hint}` });
    }
  }

  if (Number.isNaN(price) || price < 0) {
    errors.push({ field: 'price', message: 'Price must be a valid number greater than or equal to 0' });
  }

  if (Number.isNaN(mrp) || mrp < 0) {
    errors.push({ field: 'mrp', message: 'MRP must be a valid number greater than or equal to 0' });
  }

  if (!Number.isNaN(price) && !Number.isNaN(mrp) && price > mrp) {
    errors.push({ field: 'price', message: 'Price must be less than or equal to MRP' });
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.push({ field: 'variants', message: 'At least one variant is required' });
  } else {
    variants.forEach((variant, index) => {
      const size = String(variant.size || '').trim();
      const color = String(variant.color || '').trim();
      const stock = asNumber(variant.stock);
      const variantPriceRaw = variant.price;
      const variantMrpRaw = variant.mrp;
      const variantPriceProvided = !(variantPriceRaw === undefined || variantPriceRaw === null || String(variantPriceRaw).trim() === '');
      const variantMrpProvided = !(variantMrpRaw === undefined || variantMrpRaw === null || String(variantMrpRaw).trim() === '');
      const variantPrice = asNumber(variantPriceRaw);
      const variantMrp = asNumber(variantMrpRaw);
      const hasExistingImage = !!String(variant.image || '').trim();

      if (!size) errors.push({ field: `variants[${index}].size`, message: 'Size is required' });
      if (!color && !hasExistingImage) errors.push({ field: `variants[${index}].color`, message: 'Color is required' });
      if (Number.isNaN(stock) || stock < 0) {
        errors.push({ field: `variants[${index}].stock`, message: 'Stock must be a number greater than or equal to 0' });
      }
      if (variantPriceProvided || variantMrpProvided) {
        if (!variantPriceProvided || Number.isNaN(variantPrice) || variantPrice < 0) {
          errors.push({ field: `variants[${index}].price`, message: 'Variant price must be a valid number greater than or equal to 0' });
        }
        if (!variantMrpProvided || Number.isNaN(variantMrp) || variantMrp < 0) {
          errors.push({ field: `variants[${index}].mrp`, message: 'Variant MRP must be a valid number greater than or equal to 0' });
        }
        if (!Number.isNaN(variantPrice) && !Number.isNaN(variantMrp) && variantPrice > variantMrp) {
          errors.push({ field: `variants[${index}].price`, message: 'Variant price must be less than or equal to variant MRP' });
        }
      }
    });
  }

  if (errors.length) {
    cleanupUploadedFiles(req.files);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  req.body.productName = productName;
  req.body.mainCategory = mainCategory;
  req.body.subCategory = subCategory;
  req.body.itemCategory = itemCategory;
  req.body.price = String(price);
  req.body.mrp = String(mrp);
  req.body.variants = variants;
  
  return next();
};

module.exports = {
  validateProductPayload,
};
