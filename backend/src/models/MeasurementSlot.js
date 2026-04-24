const mongoose = require('mongoose');

const measurementSlotSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dateTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    orderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    garmentType: {
      type: String,
      enum: ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta', 'Other'],
    },
    notes: { type: String },
    adminNotes: { type: String },
    rescheduledTo: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

measurementSlotSchema.index(
  { dateTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'approved'] } },
    name: 'unique_active_measurement_slot',
  }
);

module.exports = mongoose.model('MeasurementSlot', measurementSlotSchema);
