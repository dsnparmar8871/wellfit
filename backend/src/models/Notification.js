const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'order_confirmed',
        'order_status_change',
        'slot_approved',
        'slot_rejected',
        'slot_rescheduled',
        'payment_success',
        'payment_failed',
        'general',
      ],
      required: true,
    },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['email', 'sms', 'push'], default: 'email' },
    sentAt: Date,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    metadata: { type: Map, of: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
