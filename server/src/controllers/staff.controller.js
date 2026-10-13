import { Order } from '../models/Order.js';
import { Outlet } from '../models/Outlet.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, escapeRegex } from '../utils/respond.js';
import { startOfDayIST } from '../utils/time.js';
import { ACTIVE_ORDER_STATUSES } from '../services/orderStateMachine.js';
import { changeOrderStatus } from '../services/orderService.js';
import { confirmManualPayment } from '../services/paymentService.js';
import { serializeOrder } from '../services/serializers.js';

export const myOutlets = asyncHandler(async (req, res) => {
  const outlets = await Outlet.find({ _id: { $in: req.user.outletIds }, isActive: true }).select('name slug isAcceptingOrders').lean();
  return ok(res, { outlets: outlets.map((o) => ({ id: String(o._id), name: o.name, slug: o.slug, isAcceptingOrders: o.isAcceptingOrders })) });
});

// The queue is limited to the carts this staff member is assigned to.
export const listOrders = asyncHandler(async (req, res) => {
  const { scope, q } = req.valid.query;
  const filter = { outlet: { $in: req.user.outletIds } };
  let sort = { createdAt: 1 }; // oldest first, so nobody waits longer than they should

  if (q) {
    filter.$or = [{ orderNumber: { $regex: escapeRegex(q), $options: 'i' } }];
    sort = { createdAt: -1 };
  } else if (scope === 'active') {
    filter.status = { $in: ACTIVE_ORDER_STATUSES };
  } else {
    filter.status = { $in: ['Completed', 'Cancelled'] };
    filter.createdAt = { $gte: startOfDayIST() }; // completed list shows today
    sort = { createdAt: -1 };
  }
  const orders = await Order.find(filter).sort(sort).limit(100);
  return ok(res, { orders: orders.map((o) => serializeOrder(o, 'staff')) });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, pin, reason } = req.valid.body;
  const order = await changeOrderStatus({ orderId: req.params.id, toStatus: status, user: req.user, pin, reason, ip: req.ip });
  return ok(res, { order: serializeOrder(order, 'staff') });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const order = await confirmManualPayment({ orderId: req.params.id, user: req.user, upiReference: req.valid.body.upiReference, ip: req.ip });
  return ok(res, { order: serializeOrder(order, 'staff') });
});
