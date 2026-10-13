import QRCode from 'qrcode';
import { Order } from '../models/Order.js';
import { Outlet } from '../models/Outlet.js';
import { Payment } from '../models/Payment.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { quoteOrder, createOrder, changeOrderStatus } from '../services/orderService.js';
import { serializeOrder } from '../services/serializers.js';
import { getSettings } from '../services/settings.js';
import { buildUpiUri } from '../services/upi.js';

const mine = (req, id) => Order.findOne({ _id: id, customer: req.user._id }).populate('outlet', 'name');

export const quote = asyncHandler(async (req, res) => ok(res, await quoteOrder(req.valid.body, req.user?._id)));

export const create = asyncHandler(async (req, res) => {
  const { order, existing } = await createOrder({ user: req.user, body: req.valid.body, ip: req.ip });
  await order.populate('outlet', 'name');
  return ok(res, { order: serializeOrder(order, 'customer', { settings: await getSettings() }), existing }, existing ? 200 : 201);
});

export const list = asyncHandler(async (req, res) => {
  const [orders, settings] = await Promise.all([
    Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).populate('outlet', 'name'),
    getSettings(),
  ]);
  return ok(res, { orders: orders.map((o) => serializeOrder(o, 'customer', { settings })) });
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await mine(req, req.params.id);
  if (!order) throw notFound('Order not found'); // same answer for "doesn't exist" and "not yours"
  return ok(res, { order: serializeOrder(order, 'customer', { settings: await getSettings() }) });
});

export const cancel = asyncHandler(async (req, res) => {
  await changeOrderStatus({ orderId: req.params.id, toStatus: 'Cancelled', user: req.user, ip: req.ip });
  const order = await mine(req, req.params.id);
  return ok(res, { order: serializeOrder(order, 'customer', { settings: await getSettings() }) });
});

// Payment instructions for a UPI order: a QR to scan from another phone and a tap-to-pay link for this phone.
export const upiInfo = asyncHandler(async (req, res) => {
  const order = await mine(req, req.params.id);
  if (!order) throw notFound('Order not found');
  if (order.paymentMethod !== 'upi') throw badRequest('This order is not a UPI order', 'WRONG_METHOD');
  if (order.status === 'Cancelled') throw conflict('This order is cancelled', 'ORDER_CANCELLED');
  const outlet = await Outlet.findById(order.outlet).lean();
  if (!outlet?.upi?.vpa) throw conflict('UPI is not available at this cart', 'UPI_NOT_CONFIGURED');
  const payment = await Payment.findOne({ order: order._id }).lean();
  const uri = buildUpiUri({
    vpa: outlet.upi.vpa, payeeName: outlet.upi.payeeName || outlet.name, amountPaise: order.totalPaise,
    note: `Order ${order.orderNumber}`, reference: order.orderNumber.replace(/[^A-Za-z0-9]/g, ''),
  });
  return ok(res, {
    uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 320 }),
    vpa: outlet.upi.vpa, payeeName: outlet.upi.payeeName || outlet.name,
    amountPaise: order.totalPaise, paymentStatus: payment?.status || order.paymentStatus,
  });
});
