import mongoose from 'mongoose';

// Atomic counters, used for order numbers (one counter per cart per day).
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);
