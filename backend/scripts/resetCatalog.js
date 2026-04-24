require('dotenv').config();
const mongoose = require('mongoose');

const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { MAIN_CATEGORIES, getSubCategories, getItemCategories } = require('../src/utils/categories');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wellfit';

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const titleCase = (value) => String(value).replace(/-/g, ' ');

const buildProducts = () => {
  const productSeeds = [];

  const clothesSubCategories = getSubCategories('Clothes');
  clothesSubCategories.forEach((subCategory, subIndex) => {
    const items = getItemCategories('Clothes', subCategory);
    items.forEach((itemCategory, itemIndex) => {
      const basePrice = 850 + subIndex * 250 + itemIndex * 125;
      const mrp = basePrice + 350;
      const slug = `${slugify(itemCategory)}-${slugify(subCategory)}-wellfit`;
      const image = `https://placehold.co/600x800/FFF2E1/A79277?text=${encodeURIComponent(itemCategory)}`;

      productSeeds.push({
        productName: `${itemCategory} ${titleCase(subCategory)} Edition`,
        slug,
        description: `${itemCategory} crafted for ${subCategory} with premium finish and modern fit.`,
        mainCategory: 'Clothes',
        subCategory,
        itemCategory,
        price: basePrice,
        mrp,
        tags: [slugify(itemCategory), slugify(subCategory), 'menswear'],
        images: [image],
        variants: [
          { size: 'M', color: 'Navy', stock: 14, image },
          { size: 'L', color: 'Black', stock: 10, image },
        ],
        isActive: true,
        isFeatured: subIndex === 0 && itemIndex < 2,
        isStitchingAvailable: subCategory === 'Custom Tailored',
        avgRating: 4.2,
        totalReviews: 5 + itemIndex,
        soldCount: 20 + itemIndex * 3,
      });
    });
  });

  const accessoryItems = getItemCategories('Accessories', '');
  accessoryItems.forEach((itemCategory, index) => {
    const basePrice = 250 + index * 120;
    const mrp = basePrice + 200;
    const slug = `${slugify(itemCategory)}-accessory-wellfit`;
    const image = `https://placehold.co/600x800/FFF2E1/A79277?text=${encodeURIComponent(itemCategory)}`;

    productSeeds.push({
      productName: `${itemCategory} Premium`,
      slug,
      description: `Premium ${itemCategory.toLowerCase()} for daily wear and refined styling.`,
      mainCategory: 'Accessories',
      subCategory: '',
      itemCategory,
      price: basePrice,
      mrp,
      tags: [slugify(itemCategory), 'accessory'],
      images: [image],
      variants: [
        { size: 'Standard', color: 'Black', stock: 25, image },
      ],
      isActive: true,
      isFeatured: index < 2,
      avgRating: 4.1,
      totalReviews: 4 + index,
      soldCount: 15 + index * 2,
    });
  });

  return productSeeds;
};

const seedCategories = async () => {
  const categoryIds = {};

  for (let i = 0; i < MAIN_CATEGORIES.length; i += 1) {
    const main = MAIN_CATEGORIES[i];
    const doc = await Category.create({
      name: main,
      slug: slugify(main),
      description: `${main} category`,
      sortOrder: i + 1,
    });
    categoryIds[`${main}`] = doc._id;
  }

  const clothesSubCategories = getSubCategories('Clothes');
  for (let i = 0; i < clothesSubCategories.length; i += 1) {
    const sub = clothesSubCategories[i];
    const subDoc = await Category.create({
      name: sub,
      slug: `${slugify('Clothes')}-${slugify(sub)}`,
      parentCategory: categoryIds.Clothes,
      description: `${sub} under Clothes`,
      sortOrder: i + 1,
    });

    const items = getItemCategories('Clothes', sub);
    for (let j = 0; j < items.length; j += 1) {
      const item = items[j];
      await Category.create({
        name: item,
        slug: `${slugify('Clothes')}-${slugify(sub)}-${slugify(item)}`,
        parentCategory: subDoc._id,
        description: `${item} under ${sub}`,
        sortOrder: j + 1,
      });
    }
  }

  const accessoryItems = getItemCategories('Accessories', '');
  for (let i = 0; i < accessoryItems.length; i += 1) {
    const item = accessoryItems[i];
    await Category.create({
      name: item,
      slug: `${slugify('Accessories')}-${slugify(item)}`,
      parentCategory: categoryIds.Accessories,
      description: `${item} under Accessories`,
      sortOrder: i + 1,
    });
  }
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  await Product.deleteMany({});
  await Category.deleteMany({});
  console.log('Removed old products and categories');

  await seedCategories();
  const products = await Product.insertMany(buildProducts());

  const readyShirt = products.find((p) => p.mainCategory === 'Clothes' && p.subCategory === 'Ready-to-Wear' && p.itemCategory === 'Shirt');
  const tailoredBlazer = products.find((p) => p.mainCategory === 'Clothes' && p.subCategory === 'Custom Tailored' && p.itemCategory === 'Blazer');
  const accessoriesForLinks = products.filter((p) => p.mainCategory === 'Accessories').slice(0, 3);

  if (readyShirt && tailoredBlazer && accessoriesForLinks.length >= 2) {
    await Product.findByIdAndUpdate(readyShirt._id, {
      relatedProducts: [tailoredBlazer._id],
      recommendedAccessories: accessoriesForLinks.map((p) => p._id),
    });
  }

  console.log(`Seeded ${products.length} products across new categories`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Catalog reset failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
