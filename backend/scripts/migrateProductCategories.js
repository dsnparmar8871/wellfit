require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const {
  MAIN_CATEGORIES,
  getItemCategories,
  getSubCategories,
  isValidCategoryPath,
} = require('../src/utils/categories');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wellfit';
const dryRun = process.argv.includes('--dry-run');

const READY_TO_WEAR_ITEMS = new Set(getItemCategories('Clothes', 'Ready-to-Wear'));
const CUSTOM_TAILORED_ITEMS = new Set(getItemCategories('Clothes', 'Custom Tailored'));
const ACCESSORY_ITEMS = new Set(getItemCategories('Accessories', ''));

const ITEM_ALIAS_PATTERNS = {
  Shirt: [/\bshirt\b/i, /\bshirts\b/i],
  Trouser: [/\btrouser\b/i, /\btrousers\b/i, /\bpants\/trousers\b/i],
  Jeans: [/\bjeans\b/i],
  Hoody: [/\bhoody\b/i, /\bhoodie\b/i],
  'T-Shirt': [/\bt-?shirt\b/i, /\btee\b/i],
  Jacket: [/\bjacket\b/i],
  Pant: [/\bpant\b/i, /\bpants\b/i],
  'Kurta-Koti': [/\bkurta\b/i, /\bkoti\b/i, /\bkoti-kurta\b/i],
  Blazer: [/\bblazer\b/i, /\bsuit\b/i, /\bsuits\/blazers\b/i],
  Jodhpuri: [/\bjodhpuri\b/i, /\bbandhgala\b/i],
  'Indo-Western': [/\bindo\s*-?\s*western\b/i, /\bindowestern\b/i],
  Sherwani: [/\bsherwani\b/i],
  Socks: [/\bsock\b/i, /\bsocks\b/i],
  Hanky: [/\bhanky\b/i, /\bhandkerchief\b/i],
  Vest: [/\bvest\b/i],
  Trunk: [/\btrunk\b/i],
  Wallet: [/\bwallet\b/i],
  Belt: [/\bbelt\b/i],
  Perfume: [/\bperfume\b/i, /\bfragrance\b/i],
};

const ACCESSORY_HINTS = [/\baccessor/i, /\bsocks?\b/i, /\bhandkerchief\b/i, /\bwallet\b/i, /\bbelt\b/i, /\bperfume\b/i, /\bvest\b/i, /\btrunk\b/i, /\bhanky\b/i, /\btie\b/i];

const normalizeText = (value) => {
  if (!value) return '';
  return String(value).toLowerCase().trim();
};

const detectItemCategory = (textSources) => {
  const haystack = textSources.filter(Boolean).join(' | ');
  for (const [item, patterns] of Object.entries(ITEM_ALIAS_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(haystack))) return item;
  }
  return null;
};

const inferMainCategory = (mainCategory, itemCategory, textSources) => {
  if (MAIN_CATEGORIES.includes(mainCategory)) return mainCategory;
  if (itemCategory && ACCESSORY_ITEMS.has(itemCategory)) return 'Accessories';

  const haystack = textSources.filter(Boolean).join(' | ');
  if (ACCESSORY_HINTS.some((pattern) => pattern.test(haystack))) return 'Accessories';
  return 'Clothes';
};

const inferSubCategory = (mainCategory, subCategory, itemCategory) => {
  if (mainCategory === 'Accessories') return '';

  const validSubCategories = getSubCategories('Clothes');
  if (validSubCategories.includes(subCategory)) return subCategory;

  if (itemCategory && CUSTOM_TAILORED_ITEMS.has(itemCategory)) return 'Custom Tailored';
  if (itemCategory && READY_TO_WEAR_ITEMS.has(itemCategory)) return 'Ready-to-Wear';

  return 'Ready-to-Wear';
};

const mapLegacyProduct = (product, categoryIndex) => {
  const productName = String(product.productName || product.name || '').trim();
  const legacySubCategory = String(product.subCategory || product.subcategory || '').trim();

  const categoryDoc = product.category ? categoryIndex.get(String(product.category)) : null;
  const parentCategoryDoc = categoryDoc?.parentCategory ? categoryIndex.get(String(categoryDoc.parentCategory)) : null;

  const categoryName = normalizeText(categoryDoc?.name);
  const parentCategoryName = normalizeText(parentCategoryDoc?.name);
  const tagsText = Array.isArray(product.tags) ? product.tags.join(' ') : '';

  const textSources = [
    normalizeText(productName),
    normalizeText(legacySubCategory),
    categoryName,
    parentCategoryName,
    normalizeText(tagsText),
  ];

  let itemCategory = product.itemCategory && String(product.itemCategory).trim();
  if (!itemCategory) itemCategory = detectItemCategory(textSources);

  let mainCategory = inferMainCategory(product.mainCategory, itemCategory, textSources);
  let subCategory = inferSubCategory(mainCategory, product.subCategory, itemCategory);

  if (!itemCategory) {
    return {
      ok: false,
      reason: 'Could not infer itemCategory',
      payload: { productName, mainCategory, subCategory, itemCategory: null },
    };
  }

  if (!isValidCategoryPath(mainCategory, subCategory, itemCategory)) {
    if (ACCESSORY_ITEMS.has(itemCategory)) {
      mainCategory = 'Accessories';
      subCategory = '';
    } else if (READY_TO_WEAR_ITEMS.has(itemCategory)) {
      mainCategory = 'Clothes';
      subCategory = 'Ready-to-Wear';
    } else if (CUSTOM_TAILORED_ITEMS.has(itemCategory)) {
      mainCategory = 'Clothes';
      subCategory = 'Custom Tailored';
    }
  }

  if (!isValidCategoryPath(mainCategory, subCategory, itemCategory)) {
    return {
      ok: false,
      reason: 'Invalid category path after mapping',
      payload: { productName, mainCategory, subCategory, itemCategory },
    };
  }

  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => ({
        size: variant.size || '',
        color: variant.color || '',
        stock: Number(variant.stock) || 0,
        image: variant.image || product.images?.[0] || '',
      }))
    : [];

  return {
    ok: true,
    payload: {
      productName,
      description: String(product.description || ''),
      mainCategory,
      subCategory,
      itemCategory,
      variants,
      images: variants.map((variant) => variant.image).filter(Boolean),
    },
  };
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB (${dryRun ? 'dry-run' : 'write mode'})`);

  const [categories, products] = await Promise.all([
    Category.find({}).lean(),
    Product.collection.find({}).toArray(),
  ]);

  const categoryIndex = new Map(categories.map((category) => [String(category._id), category]));

  let migrated = 0;
  let skipped = 0;
  const skippedRows = [];
  const updates = [];

  for (const product of products) {
    const mapped = mapLegacyProduct(product, categoryIndex);
    if (!mapped.ok) {
      skipped += 1;
      skippedRows.push({ id: String(product._id), name: product.productName || product.name || '', reason: mapped.reason });
      continue;
    }

    updates.push({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: mapped.payload,
          $unset: {
            name: '',
            category: '',
            subcategory: '',
          },
        },
      },
    });

    migrated += 1;
  }

  if (!dryRun && updates.length) {
    await Product.bulkWrite(updates, { ordered: false });
  }

  console.log('Migration completed');
  console.log(`Total products: ${products.length}`);
  console.log(`Mapped: ${migrated}`);
  console.log(`Skipped: ${skipped}`);

  if (skippedRows.length) {
    console.log('Skipped products (first 20):');
    skippedRows.slice(0, 20).forEach((row) => {
      console.log(`- ${row.id} | ${row.name} | ${row.reason}`);
    });
  }

  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exit(1);
  });
