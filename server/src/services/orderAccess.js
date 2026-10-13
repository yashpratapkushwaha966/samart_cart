import { Order } from '../models/Order.js';
import { notFound } from '../utils/AppError.js';

export const actorOf = (user) => ({ id: String(user._id), role: user.role, outletIds: (user.outletIds || []).map(String) });

/**
 * Loads an order only if this person is allowed to touch it. Otherwise answers "not found",
 * so nobody can discover which order numbers exist.
 *  - admin: any order
 *  - staff: only orders of the carts they are assigned to
 *  - customer: only their own orders
 */
export async function loadOrderForActor(orderId, actor, populate = '') {
  const filter = { _id: orderId };
  if (actor.role === 'staff') filter.outlet = { $in: actor.outletIds };
  if (actor.role === 'customer') filter.customer = actor.id;
  const q = Order.findOne(filter);
  if (populate) q.populate(populate);
  const order = await q;
  if (!order) throw notFound('Order not found');
  return order;
}
