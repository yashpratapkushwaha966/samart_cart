import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9]{3,20}$/ },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    type: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: 1, validate: Number.isInteger }, // percent (1-100) or paise
    minOrderPaise: { type: Number, default: 0, min: 0 },
    maxDiscountPaise: { type: Number, default: 0, min: 0 }, // 0 = no cap (percent offers)
    startsAt: Date,
    expiresAt: Date,
    usageLimit: { type: Number, default: 0, min: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 0 }, // 0 = unlimited
    eligibleProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], // empty = all products
    showOnHome: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

offerSchema.pre('validate', function check(next) {
  if (this.type === 'percent' && this.value > 100) this.invalidate('value', 'Percent discount cannot exceed 100');
  next();
});

export const Offer = mongoose.model('Offer', offerSchema);
