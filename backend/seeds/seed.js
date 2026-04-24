require('dotenv').config();
const mongoose = require('mongoose');

// Models
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Coupon = require('../src/models/Coupon');
const Order = require('../src/models/Order');
const MeasurementTemplate = require('../src/models/MeasurementTemplate');
const { MAIN_CATEGORIES, getSubCategories, getItemCategories } = require('../src/utils/categories');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wellfit';

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const titleCase = (value) => String(value).replace(/-/g, ' ');

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Coupon.deleteMany({}),
      Order.deleteMany({}),
      MeasurementTemplate.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // ── Users ──────────────────────────────────────────────────────────────────
    // NOTE: Pass PLAIN TEXT passwords here.
    // The User model's pre('save') hook hashes them automatically with bcrypt.
    // Do NOT pre-hash with bcrypt.hash() — that causes double-hashing and breaks login.

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@wellfit.com',
      phone: '9999999999',
      passwordHash: 'admin123',       // plain text → model hashes it
      role: 'admin',
      isActive: true,
    });

    const tailor1 = await User.create({
      name: 'Ramesh Tailor',
      email: 'tailor1@wellfit.com',
      phone: '9988776655',
      passwordHash: 'password123',    // plain text → model hashes it
      role: 'tailor',
      isActive: true,
    });

    const tailor2 = await User.create({
      name: 'Suresh Darzi',
      email: 'tailor2@wellfit.com',
      phone: '9977665544',
      passwordHash: 'password123',
      role: 'tailor',
      isActive: true,
    });

    const customer1 = await User.create({
      name: 'Rahul Sharma',
      email: 'customer@wellfit.com',
      phone: '9876543210',
      passwordHash: 'password123',    // plain text → model hashes it
      role: 'customer',
      addresses: [
        {
          label: 'Home',
          line1: '12, Shyam Nagar',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '395003',
          isDefault: true,
        },
      ],
      isActive: true,
    });

    const customer2 = await User.create({
      name: 'Amit Patel',
      email: 'amit@wellfit.com',
      phone: '9123456789',
      passwordHash: 'password123',
      role: 'customer',
      isActive: true,
    });

    console.log('👤 Users seeded');

    // ── Categories ─────────────────────────────────────────────────────────────
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
      categoryIds[`Clothes>${sub}`] = subDoc._id;

      const items = getItemCategories('Clothes', sub);
      for (let j = 0; j < items.length; j += 1) {
        const item = items[j];
        const itemDoc = await Category.create({
          name: item,
          slug: `${slugify('Clothes')}-${slugify(sub)}-${slugify(item)}`,
          parentCategory: subDoc._id,
          description: `${item} under ${sub}`,
          sortOrder: j + 1,
        });
        categoryIds[`Clothes>${sub}>${item}`] = itemDoc._id;
      }
    }

    const accessoryItems = getItemCategories('Accessories', '');
    for (let i = 0; i < accessoryItems.length; i += 1) {
      const item = accessoryItems[i];
      const itemDoc = await Category.create({
        name: item,
        slug: `${slugify('Accessories')}-${slugify(item)}`,
        parentCategory: categoryIds.Accessories,
        description: `${item} under Accessories`,
        sortOrder: i + 1,
      });
      categoryIds[`Accessories>>${item}`] = itemDoc._id;
    }

    console.log('📂 Categories seeded (new hierarchy)');

    // ── Products: one per item path ───────────────────────────────────────────
    const productSeeds = [];

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

    const products = await Product.insertMany(productSeeds);

    const readyShirt = products.find((p) => p.mainCategory === 'Clothes' && p.subCategory === 'Ready-to-Wear' && p.itemCategory === 'Shirt');
    const tailoredBlazer = products.find((p) => p.mainCategory === 'Clothes' && p.subCategory === 'Custom Tailored' && p.itemCategory === 'Blazer');
    const accessoriesForLinks = products.filter((p) => p.mainCategory === 'Accessories').slice(0, 3);

    if (readyShirt && tailoredBlazer && accessoriesForLinks.length >= 2) {
      await Product.findByIdAndUpdate(readyShirt._id, {
        relatedProducts: [tailoredBlazer._id],
        recommendedAccessories: accessoriesForLinks.map((p) => p._id),
      });
    }

    console.log('📦 Products seeded');

    // ── Coupons ────────────────────────────────────────────────────────────────
    await Coupon.insertMany([
      {
        code: 'WELCOME10',
        description: '10% off on first order',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 500,
        minOrder: 500,
        usageLimit: 1000,
        perUserLimit: 1,
        expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        code: 'FLAT200',
        description: 'Flat ₹200 off on orders above ₹2000',
        discountType: 'flat',
        discountValue: 200,
        minOrder: 2000,
        usageLimit: 500,
        expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        code: 'WEDDING20',
        description: '20% off on wedding collection',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscount: 2000,
        minOrder: 3000,
        usageLimit: 200,
        expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        code: 'TAILOR15',
        description: '15% off on stitching orders',
        discountType: 'percentage',
        discountValue: 15,
        maxDiscount: 1000,
        minOrder: 1000,
        usageLimit: 300,
        expiry: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    ]);
    console.log('🎫 Coupons seeded');

    // ── Measurement Templates ──────────────────────────────────────────────────
    await MeasurementTemplate.insertMany([
      {
        customer: customer1._id,
        garmentType: 'Shirt',
        name: 'My Standard Shirt',
        measurements: {
          chest: 40, waist: 34, shoulder: 17, sleeve: 25, neck: 15, length: 28,
        },
        notes: 'Slightly relaxed fit at chest',
        isDefault: true,
      },
      {
        customer: customer1._id,
        garmentType: 'Pants',
        name: 'Formal Trousers',
        measurements: {
          waist: 32, hip: 40, inseam: 30, thigh: 22, crotch: 11, length: 42,
        },
        notes: 'Slim fit, 1 inch bottom hem',
        isDefault: true,
      },
      {
        customer: customer2._id,
        garmentType: 'Sherwani',
        name: 'Wedding Sherwani',
        measurements: {
          chest: 42, waist: 36, shoulder: 18, sleeve: 26, neck: 16, length: 45, hip: 42,
        },
        notes: 'For brother\'s wedding - slim fit',
        isDefault: true,
      },
    ]);
    console.log('📏 Measurement templates seeded');

    // ── Sample Order ───────────────────────────────────────────────────────────
    const sampleClothing = products.find((p) => p.mainCategory === 'Clothes' && p.itemCategory === 'Shirt') || products[0];
    const sampleAccessory = products.find((p) => p.mainCategory === 'Accessories' && p.itemCategory === 'Belt') || products[products.length - 1];
    const clothingVariant = sampleClothing.variants?.[0];
    const accessoryVariant = sampleAccessory.variants?.[0];

    const sampleOrder = await Order.create({
      customer: customer1._id,
      items: [
        {
          product: sampleClothing._id,
          variantId: clothingVariant?._id,
          variantDetails: { size: clothingVariant?.size || 'M', color: clothingVariant?.color || 'Navy' },
          qty: 2,
          price: sampleClothing.price,
        },
        {
          product: sampleAccessory._id,
          variantId: accessoryVariant?._id,
          variantDetails: { size: accessoryVariant?.size || 'Standard', color: accessoryVariant?.color || 'Black' },
          qty: 1,
          price: sampleAccessory.price,
        },
      ],
      shippingAddress: {
        name: 'Rahul Sharma',
        phone: '9876543210',
        line1: '12, Shyam Nagar',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395003',
      },
      subtotal: sampleClothing.price * 2 + sampleAccessory.price,
      discountAmount: 0,
      totalAmount: sampleClothing.price * 2 + sampleAccessory.price,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'processing',
      statusHistory: [
        { status: 'received', note: 'Order placed', updatedBy: customer1._id },
        { status: 'processing', note: 'Order is being processed', updatedBy: admin._id },
      ],
      assignedTailor: tailor1._id,
      qrCode: 'data:image/png;base64,iVBORw0KGgo=',
    });
    console.log('🛒 Sample order seeded');

    console.log('\n✅ ═══════════════════════════════════════════════════');
    console.log('   WELLFIT DATABASE SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n📋 Demo Credentials:');
    console.log('   Admin:    admin@wellfit.com    / admin123');
    console.log('   Tailor:   tailor1@wellfit.com  / password123');
    console.log('   Customer: customer@wellfit.com / password123');
    console.log('\n🎫 Test Coupons: WELCOME10 | FLAT200 | WEDDING20 | TAILOR15');
    console.log('═══════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedData();
