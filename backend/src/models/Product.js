const mongoose = require('mongoose');
const {
  MAIN_CATEGORIES,
  SUB_CATEGORIES,
  ITEM_CATEGORIES,
  getItemCategories,
  isValidCategoryPath,
} = require('../utils/categories');

const toComparable = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\u00A0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const variantSchema = new mongoose.Schema({
  size: { type: String, trim: true },
  color: { type: String, trim: true },
  stock: { type: Number, default: 0, min: 0 },
  image: { type: String, trim: true },
  price: {
    type: Number,
    min: [0, 'Variant price cannot be negative'],
    validate: {
      validator(value) {
        if (value == null) return true;
        if (this.mrp == null) return true;
        return value <= this.mrp;
      },
      message: 'Variant price must be less than or equal to variant MRP',
    },
  },
  mrp: { type: Number, min: [0, 'Variant MRP cannot be negative'] },
});

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    mainCategory: { type: String, required: true, enum: MAIN_CATEGORIES, index: true },
    subCategory: {
      type: String,
      trim: true,
      enum: SUB_CATEGORIES,
      default: '',
      required: function requiredSubCategory() {
        return this.mainCategory === 'Clothes';
      },
      validate: {
        validator(value) {
          const update = typeof this?.getUpdate === 'function' ? this.getUpdate() : null;
          const mainCategoryFromUpdate = update?.$set?.mainCategory ?? update?.mainCategory;
          const mainCategory = mainCategoryFromUpdate ?? this.mainCategory;

          if (mainCategory === 'Clothes') {
            return value === 'Ready-to-Wear' || value === 'Custom Tailored';
          }
          if (mainCategory === 'Accessories') {
            return value === '';
          }
          return SUB_CATEGORIES.includes(value);
        },
        message: 'Sub-category is invalid for the selected main category',
      },
      index: true,
    },
    itemCategory: { type: String, required: true, enum: ITEM_CATEGORIES, index: true },
    images: [{ type: String }],
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
      validate: {
        validator(value) {
          if (this.mrp == null) return true;
          return value <= this.mrp;
        },
        message: 'Price must be less than or equal to MRP',
      },
    },
    mrp: { type: Number, required: true, min: [0, 'MRP cannot be negative'] },
    tags: [{ type: String, trim: true, lowercase: true }],
    variants: { type: [variantSchema], default: [] },
    ratings: [ratingSchema],
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    isStitchingAvailable: { type: Boolean, default: false },
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    recommendedAccessories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    totalStock: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto slug
productSchema.pre('validate', function (next) {
  if (!this.productName && this.name) this.productName = this.name;
  if (this.mainCategory === 'Accessories') this.subCategory = '';

  if (this.mainCategory && this.itemCategory) {
    const itemOptions = getItemCategories(this.mainCategory, this.subCategory || '');
    const matchesAllowedOptions = itemOptions.some(
      (option) => toComparable(option) === toComparable(this.itemCategory)
    );
    const matchesPath = isValidCategoryPath(this.mainCategory, this.subCategory || '', this.itemCategory);

    if (!matchesAllowedOptions && !matchesPath) {
      this.invalidate('itemCategory', 'Item category does not match selected category path');
    }
  }

  if (this.productName && !this.slug) {
    this.slug =
      this.productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now();
  }
  next();
});

// Recalculate totalStock before save
productSchema.pre('save', function (next) {
  if (this.variants && this.variants.length > 0) {
    this.totalStock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    // Remove automatic overwriting of this.images to allow extra images

    const variantsWithPrice = this.variants.filter(
      (variant) => typeof variant.price === 'number' && Number.isFinite(variant.price)
    );
    if (variantsWithPrice.length > 0) {
      const cheapestVariant = variantsWithPrice.reduce(
        (minVariant, current) => (current.price < minVariant.price ? current : minVariant),
        variantsWithPrice[0]
      );
      this.price = cheapestVariant.price;
      if (typeof cheapestVariant.mrp === 'number' && Number.isFinite(cheapestVariant.mrp)) {
        this.mrp = Math.max(cheapestVariant.price, cheapestVariant.mrp);
      }
    }
  }
  next();
});

productSchema.virtual('name')
  .get(function getName() {
    return this.productName;
  })
  .set(function setName(value) {
    this.productName = value;
  });

// Text index for search
productSchema.index({ productName: 'text', description: 'text', itemCategory: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
