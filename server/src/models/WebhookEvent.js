import mongoose from 'mongoose';

// Each payment-gateway event id is stored once. A repeated delivery hits the unique index and is skipped.
const webhookSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    type: String,
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // keep 90 days
  },
  { versionKey: false }
);

export const WebhookEvent = mongoose.model('WebhookEvent', webhookSchema);
