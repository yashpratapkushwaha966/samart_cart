import mongoose from 'mongoose';

// An "Outlet" is one physical cart. The customer shopping basket is NOT stored in the database.
const hoursSchema = new mongoose.Schema(
  { day: { type: Number, min: 0, max: 6, required: true }, closed: { type: Boolean, default: false }, open: String, close: String },
  { _id: false }
);

const outletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9]{2,6}$/ },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ },
    address: { type: String, trim: true, maxlength: 200 },
    openingHours: [hoursSchema],
    isAcceptingOrders: { type: Boolean, default: true }, // manual pause switch
    isActive: { type: Boolean, default: true },
    upi: { vpa: { type: String, trim: true, maxlength: 80 }, payeeName: { type: String, trim: true, maxlength: 80 } },
  },
  { timestamps: true }
);

export const Outlet = mongoose.model('Outlet', outletSchema);
