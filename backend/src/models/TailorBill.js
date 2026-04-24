const mongoose = require('mongoose');

const tailorBillSchema = new mongoose.Schema(
  {
    tailor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'paid'], default: 'pending', index: true },
    paymentStatus: { type: String, enum: ['Pending', 'Done'], default: 'Pending', index: true },
    requestDate: { type: Date, default: Date.now },
    collectionDate: Date,
    paymentCompletedAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    billNumber: { type: String, unique: true },
    notes: String,
    pdfUrl: String,
  },
  { timestamps: true }
);

tailorBillSchema.pre('save', async function () {
  if (!this.billNumber) {
    const count = await mongoose.model('TailorBill').countDocuments();
    this.billNumber = `TB${String(count + 1).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('TailorBill', tailorBillSchema);
