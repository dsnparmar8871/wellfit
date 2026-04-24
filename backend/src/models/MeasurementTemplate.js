const mongoose = require('mongoose');

const measurementsSchema = new mongoose.Schema({
  chest: Number,
  waist: Number,
  hip: Number,
  sleeve: Number,
  length: Number,
  shoulder: Number,
  neck: Number,
  crotch: Number,
  thigh: Number,
  inseam: Number,
  bicep: Number,
  wrist: Number,
  frontLength: Number,
  backLength: Number,
  kurtiLength: Number,
  // Extra custom fields
  extra: { type: Map, of: Number },
});

const measurementTemplateSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    garmentType: {
      type: String,
      enum: ['Shirt', 'Pants', 'Blazer', 'Jodhpuri', 'Indo-Western', 'Sherwani', 'Kurta'],
      required: true,
    },
    name: { type: String, required: true, trim: true }, // e.g. "My Wedding Sherwani"
    measurements: measurementsSchema,
    notes: { type: String },
    referencePhotos: [{ type: String }],
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MeasurementTemplate', measurementTemplateSchema);
