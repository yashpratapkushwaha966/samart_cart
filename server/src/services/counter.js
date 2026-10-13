import { Counter } from '../models/Counter.js';

// Atomic: two simultaneous orders can never receive the same number.
export async function nextSequence(key) {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
}
