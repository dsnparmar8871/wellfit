/**
 * Cleanup script: Remove return requests from non-delivered orders
 * Run: node scripts/cleanupInvalidReturns.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../src/models/Order');

const cleanup = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Finding orders with return requests on non-delivered orders...');
    const orders = await Order.find({
      $and: [
        { status: { $ne: 'delivered' } },
        { 'items.returnRequest.status': { $exists: true } }
      ]
    });

    if (orders.length === 0) {
      console.log('✓ No invalid return requests found. Database is clean.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`Found ${orders.length} order(s) with invalid return requests\n`);

    let totalRemoved = 0;
    for (const order of orders) {
      order.items = order.items.map((item) => {
        if (item.returnRequest?.status && order.status !== 'delivered') {
          console.log(`  Removing invalid return from Order ${order._id} (Status: ${order.status})`);
          totalRemoved++;
          return { ...item.toObject(), returnRequest: undefined };
        }
        return item;
      });
      await order.save();
    }

    console.log(`\n✓ Cleanup complete. Removed ${totalRemoved} invalid return request(s)`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  }
};

cleanup();
