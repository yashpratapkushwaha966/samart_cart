import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set when the person was logged in
    name: { type: String, trim: true, maxlength: 80, default: 'Guest' },
    rating: { type: Number, min: 1, max: 5, required: true },
    message: { type: String, trim: true, maxlength: 1000, required: true },
  },
  { timestamps: true }
);
feedbackSchema.index({ createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
