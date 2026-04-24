const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId },
  variantDetails: {
    size: String,
    color: String,
    fabric: String,
  },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  isStitching: { type: Boolean, default: false },
  measurementPreference: {
    type: String,
    enum: ['existing', 'book_slot', 'fabric_only', 'own_measurement', null],
    default: null,
  },
  measurementSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeasurementSlot' },
  measurementTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeasurementTemplate' },
  ownMeasurements: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  note: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  garmentType: String,
  returnRequest: {
    reason: {
      type: String,
      enum: ['size_issue', 'wrong_item', 'defective', 'not_as_described', 'changed_mind', 'other'],
    },
    details: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    refundReceiveMethod: {
      type: String,
      enum: ['upi_id', 'bank_account', 'collect_from_shop'],
    },
    upiId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    bankIfscCode: {
      type: String,
      trim: true,
      maxlength: 20,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'processing', 'rejected', 'refunded'],
    },
    requestedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    refundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    pickupDate: Date,
  },
});

const stitchingDetailsSchema = new mongoose.Schema({
  garmentType: {
    type: String,
    enum: ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta'],
  },
  measurementTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'MeasurementTemplate' },
  measurementSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'MeasurementSlot' },
  customInstructions: String,
  referencePhotos: [String],
  estimatedDays: { type: Number, default: 7 },
});

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],
    stitchingDetails: stitchingDetailsSchema,
    shippingAddress: {
      label: { type: String, default: 'Home' },
      name: String,
      phone: String,
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    shippingCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['received', 'tailoring', 'processing', 'ready', 'delivered', 'cancelled'],
      default: 'received',
      index: true,
    },
    statusHistory: [statusHistorySchema],
    paymentMethod: {
      type: String,
      enum: ['COD', 'UPI', 'credit_card', 'debit_card', 'stripe'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    stripePaymentIntentId: { type: String, unique: true, sparse: true, index: true },
    stripePaymentId: String,
    couponApplied: {
      code: String,
      discountAmount: Number,
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    },
    invoice: {
      url: String,
      generatedAt: Date,
    },
    deliveryDate: Date,
    pickupDate: Date,
    assignedTailor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    stitchingCost: { type: Number, default: 0, min: 0 },
    cancellationCharge: { type: Number, default: 0, min: 0 },
    tailorNote: String,
    qrCode: String,
    notes: String,
    isOfflineSale: { type: Boolean, default: false, index: true },
    isPickup: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate order number
// NOTE: Pure async — no next() callback (Mongoose 7+ pattern)
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `WF${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = mongoose.model('Order', orderSchema);
