import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 20 },
    // The role is NEVER taken from a request body on public routes.
    role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer', index: true },
    passwordHash: { type: String, select: false }, // only staff/admin have passwords
    pin: { type: String, match: /^\d{4}$/ }, // customer's permanent 4-digit PIN, made once and never changed
    googleId: { type: String, unique: true, sparse: true },
    outletIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Outlet' }], // carts a staff member may operate
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
