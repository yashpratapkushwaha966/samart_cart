import { Feedback } from '../models/Feedback.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { notFound } from '../utils/AppError.js';

// Anyone may leave feedback (logged in or not). Rate-limited in the route.
export const createFeedback = asyncHandler(async (req, res) => {
  const { rating, message, name } = req.valid.body;
  const firstName = (req.user?.name || name || 'Guest').split(/\s+/)[0];
  await Feedback.create({ user: req.user?._id, name: firstName, rating, message });
  return ok(res, { received: true }, 201);
});

// Owner: latest feedback and the average rating.
export const listFeedback = asyncHandler(async (req, res) => {
  const [items, agg] = await Promise.all([
    Feedback.find().sort({ createdAt: -1 }).limit(200).populate('user', 'name email phone').lean(),
    Feedback.aggregate([{ $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' } } }]),
  ]);
  return ok(res, {
    count: agg[0]?.count || 0,
    average: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0,
    items: items.map((f) => ({
      id: String(f._id), name: f.name, rating: f.rating, message: f.message, createdAt: f.createdAt,
      email: f.user?.email || null, phone: f.user?.phone || null,
    })),
  });
});

export const deleteFeedback = asyncHandler(async (req, res) => {
  const f = await Feedback.findByIdAndDelete(req.params.id);
  if (!f) throw notFound('Feedback not found');
  return ok(res, { deleted: true });
});
