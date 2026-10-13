import mongoose from 'mongoose';

// One document (key = "business") holding owner-editable business settings.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'business', unique: true },
    businessName: { type: String, default: 'Smart Momos', maxlength: 80 },
    tagline: { type: String, default: 'Hot, fresh momos, made right in front of you', maxlength: 140 },
    taxEnabled: { type: Boolean, default: false },
    taxPercent: { type: Number, default: 0, min: 0, max: 40 },
    taxLabel: { type: String, default: 'GST', maxlength: 20 },
    gstin: { type: String, default: '', maxlength: 20 }, // shown on bills if you register for GST
    packagingFeePaise: { type: Number, default: 0, min: 0, max: 50_000 },
    cancellationWindowMinutes: { type: Number, default: 5, min: 0, max: 60 },
  },
  { timestamps: true }
);

export const Setting = mongoose.model('Setting', settingSchema);
