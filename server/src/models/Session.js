import mongoose from 'mongoose';

// The browser holds a random token in an httpOnly cookie. Only its SHA-256 hash is stored here.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    role: String,
    userAgent: { type: String, maxlength: 300 },
    ip: String,
    revokedAt: Date,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB deletes it automatically
  },
  { timestamps: true }
);

export const Session = mongoose.model('Session', sessionSchema);
