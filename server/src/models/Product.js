import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    pricePaise: { type: Number, required: true, min: 100, max: 1_000_000, validate: Number.isInteger }, // stored in paise
    imageUrl: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    isVeg: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, // shown as "popular" on the home page
    isAvailable: { type: Boolean, default: true }, // quick enable / disable
    isActive: { type: Boolean, default: true },
    unavailableAtOutlets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' }], // per-cart switch for the future
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);
