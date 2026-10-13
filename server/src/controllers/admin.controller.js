import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, escapeRegex } from '../utils/respond.js';
import { notFound } from '../utils/AppError.js';
import { normalizeCode } from '../utils/codes.js';
import { startOfDayIST, startOfWeekIST, startOfMonthIST, addDays, dayKeyIST } from '../utils/time.js';
import { ACTIVE_ORDER_STATUSES } from '../services/orderStateMachine.js';
import { changeOrderStatus } from '../services/orderService.js';
import { confirmManualPayment, markRefunded } from '../services/paymentService.js';
import { serializeOrder } from '../services/serializers.js';

const TZ = 'Asia/Kolkata';
const METHODS = ['cash', 'upi', 'online'];

// ---------- helpers ----------
// Revenue = payments that are really PAID (confirmed). Not "number of orders".
async function salesSince(start) {
  const rows = await Payment.aggregate([
    { $match: { status: 'Paid', confirmedAt: { $gte: start } } },
    { $group: { _id: '$method', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
  ]);
  const byMethod = Object.fromEntries(METHODS.map((m) => [m, 0]));
  rows.forEach((r) => { byMethod[r._id] = r.totalPaise; });
  return { totalPaise: Object.values(byMethod).reduce((a, b) => a + b, 0), byMethod, payments: rows.reduce((s, r) => s + r.count, 0) };
}

const bucketExpr = (field, unit) => ({
  $dateToString: {
    format: '%Y-%m-%d', timezone: TZ,
    date: { $dateTrunc: { date: `$${field}`, unit, timezone: TZ, ...(unit === 'week' ? { startOfWeek: 'monday' } : {}) } },
  },
});

async function salesSeries(unit, since) {
  const [pay, ord] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'Paid', confirmedAt: { $gte: since } } },
      { $group: { _id: { b: bucketExpr('confirmedAt', unit), m: '$method' }, totalPaise: { $sum: '$amountPaise' } } },
    ]),
    Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: since } } },
      { $group: { _id: bucketExpr('createdAt', unit), orders: { $sum: 1 } } },
    ]),
  ]);
  const map = new Map();
  const row = (b) => {
    if (!map.has(b)) map.set(b, { bucket: b, orders: 0, salesPaise: 0, cash: 0, upi: 0, online: 0 });
    return map.get(b);
  };
  if (unit === 'day') for (let i = Math.floor((Date.now() - since.getTime()) / 86400000); i >= 0; i -= 1) row(dayKeyIST(addDays(new Date(), -i)));
  pay.forEach((p) => { const r = row(p._id.b); r[p._id.m] += p.totalPaise; r.salesPaise += p.totalPaise; });
  ord.forEach((o) => { row(o._id).orders = o.orders; });
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

async function adminOrderById(id) {
  const order = await Order.findById(id).populate('customer', 'name email phone').populate('outlet', 'name');
  if (!order) throw notFound('Order not found');
  const payment = await Payment.findOne({ order: order._id }).lean();
  return {
    ...serializeOrder(order, 'admin'),
    payment: payment && {
      status: payment.status, method: payment.method, amountPaise: payment.amountPaise, gatewayPaymentId: payment.gatewayPaymentId,
      upiReference: payment.upiReference, confirmedAt: payment.confirmedAt, confirmedByRole: payment.confirmedByRole,
      duplicatePaymentIds: payment.duplicatePaymentIds || [], refundedAt: payment.refundedAt, refundNote: payment.refundNote,
    },
  };
}

// ---------- dashboard & reports ----------
export const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = startOfDayIST(now);
  const [ordersToday, newOrders, inProgress, completedToday, cancelledToday, pendingPayments, salesToday, salesWeek, salesMonth, series, popular, recent] =
    await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ status: 'Placed' }),
      Order.countDocuments({ status: { $in: ['Accepted', 'Preparing', 'Ready'] } }),
      Order.countDocuments({ status: 'Completed', createdAt: { $gte: today } }),
      Order.countDocuments({ status: 'Cancelled', createdAt: { $gte: today } }),
      Order.countDocuments({ status: { $in: ACTIVE_ORDER_STATUSES }, paymentStatus: 'Pending' }),
      salesSince(today), salesSince(startOfWeekIST(now)), salesSince(startOfMonthIST(now)),
      salesSeries('day', startOfDayIST(addDays(now, -6))),
      Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: addDays(now, -30) } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' }, revenuePaise: { $sum: '$items.lineTotalPaise' } } },
        { $sort: { quantity: -1 } }, { $limit: 5 },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).populate('customer', 'name email phone').populate('outlet', 'name'),
    ]);
  return ok(res, {
    counts: { ordersToday, newOrders, inProgress, completedToday, cancelledToday, pendingPayments },
    sales: { today: salesToday, week: salesWeek, month: salesMonth },
    last7Days: series,
    popular: popular.map((p) => ({ name: p._id, quantity: p.quantity, revenuePaise: p.revenuePaise })),
    recentOrders: recent.map((o) => serializeOrder(o, 'admin')),
  });
});

export const reports = asyncHandler(async (req, res) => {
  const { range } = req.valid.query;
  const cfg = { daily: ['day', 29], weekly: ['week', 83], monthly: ['month', 364] }[range];
  const since = startOfDayIST(addDays(new Date(), -cfg[1]));
  const [series, refunded] = await Promise.all([
    salesSeries(cfg[0], since),
    Payment.aggregate([{ $match: { status: 'Refunded', refundedAt: { $gte: since } } }, { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } }]),
  ]);
  const totals = series.reduce((t, r) => ({
    orders: t.orders + r.orders, salesPaise: t.salesPaise + r.salesPaise, cash: t.cash + r.cash, upi: t.upi + r.upi, online: t.online + r.online,
  }), { orders: 0, salesPaise: 0, cash: 0, upi: 0, online: 0 });
  return ok(res, { range, series, totals, refundedPaise: refunded[0]?.totalPaise || 0 });
});

// ---------- orders ----------
export const listOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, method, from, to, q, page, limit } = req.valid.query;
  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (method) filter.paymentMethod = method;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = startOfDayIST(from);
    if (to) filter.createdAt.$lt = addDays(startOfDayIST(to), 1);
  }
  if (q) {
    filter.$or = [{ orderNumber: { $regex: escapeRegex(q), $options: 'i' } }];
    if (normalizeCode(q)) filter.$or.push({ couponCode: normalizeCode(q) });
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('customer', 'name email phone').populate('outlet', 'name'),
    Order.countDocuments(filter),
  ]);
  return ok(res, { orders: orders.map((o) => serializeOrder(o, 'admin')), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const getOrder = asyncHandler(async (req, res) => ok(res, { order: await adminOrderById(req.params.id) }));

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.valid.body;
  await changeOrderStatus({ orderId: req.params.id, toStatus: status, user: req.user, reason, ip: req.ip });
  return ok(res, { order: await adminOrderById(req.params.id) });
});

export const confirmOrderPayment = asyncHandler(async (req, res) => {
  await confirmManualPayment({ orderId: req.params.id, user: req.user, upiReference: req.valid.body.upiReference, ip: req.ip });
  return ok(res, { order: await adminOrderById(req.params.id) });
});

export const refundOrder = asyncHandler(async (req, res) => {
  await markRefunded({ orderId: req.params.id, user: req.user, note: req.valid.body.note, ip: req.ip });
  return ok(res, { order: await adminOrderById(req.params.id) });
});

// ---------- customers & activity ----------
export const listCustomers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40);
  const rows = await Order.aggregate([
    { $group: {
      _id: '$customer', orders: { $sum: 1 }, lastOrderAt: { $max: '$createdAt' },
      spentPaise: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalPaise', 0] } },
    } },
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    ...(q ? [{ $match: { $or: [{ 'u.email': { $regex: escapeRegex(q), $options: 'i' } }, { 'u.name': { $regex: escapeRegex(q), $options: 'i' } }] } }] : []),
    { $sort: { lastOrderAt: -1 } }, { $limit: 200 },
  ]);
  return ok(res, {
    customers: rows.map((r) => ({
      id: String(r._id), name: r.u.name || '', email: r.u.email, phone: r.u.phone || '',
      orders: r.orders, spentPaise: r.spentPaise, lastOrderAt: r.lastOrderAt, joinedAt: r.u.createdAt,
    })),
  });
});

export const listAudit = asyncHandler(async (req, res) => {
  const { action, page } = req.valid.query;
  const filter = action ? { action } : {};
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).populate('actor', 'name email').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return ok(res, {
    total, page, pages: Math.max(1, Math.ceil(total / 50)),
    logs: logs.map((l) => ({
      id: String(l._id), at: l.createdAt, action: l.action, entityType: l.entityType, entityId: l.entityId,
      actor: l.actor ? { name: l.actor.name, email: l.actor.email } : null, actorRole: l.actorRole, meta: l.meta,
    })),
  });
});
