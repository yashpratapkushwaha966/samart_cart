import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { ensurePin } from './authService.js';
import { Outlet } from '../models/Outlet.js';
import { Product } from '../models/Product.js';
import { Offer } from '../models/Offer.js';
import { Payment } from '../models/Payment.js';
import { AppError, badRequest, conflict, notFound } from '../utils/AppError.js';
import { isOpenNow, dayKeyIST } from '../utils/time.js';
import { generateCouponCode, formatOrderNumber } from '../utils/codes.js';
import { env, gatewayConfigured } from '../config/env.js';
import { computeBill } from './pricing.js';
import { ACTIVE_ORDER_STATUSES, assertTransition, assertCustomerCanCancel } from './orderStateMachine.js';
import { getSettings } from './settings.js';
import { nextSequence } from './counter.js';
import { audit } from './audit.js';
import { emitOrderEvent } from './realtime.js';
import { loadOrderForActor, actorOf } from './orderAccess.js';

const MAX_ACTIVE_ORDERS_PER_CUSTOMER = 5;

export const availablePaymentMethods = (outlet) => [
  'cash',
  ...(outlet.upi?.vpa ? ['upi'] : []),
  ...(gatewayConfigured() ? ['online'] : []),
];

// Loads everything needed to price an order from the DATABASE (never from the browser).
async function loadPricingContext({ outletSlug, items, offerCode }, userId) {
  const outlet = await Outlet.findOne({ slug: outletSlug, isActive: true }).lean();
  if (!outlet) throw notFound('This cart was not found', 'OUTLET_NOT_FOUND');

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const settings = await getSettings();

  let offer = null;
  let userOfferUses = 0;
  if (offerCode) {
    offer = await Offer.findOne({ code: offerCode }).lean();
    if (!offer) throw badRequest('This offer code is not valid', 'OFFER_INVALID');
    if (userId) {
      userOfferUses = await Order.countDocuments({ customer: userId, offerCode: offer.code, status: { $ne: 'Cancelled' } });
    }
  }
  const bill = computeBill({ items, productsById, outletId: outlet._id, offer, userOfferUses, settings });
  return { outlet, settings, offer, bill };
}

export async function quoteOrder(body, userId) {
  const { outlet, bill } = await loadPricingContext(body, userId);
  return {
    bill,
    isOpen: outlet.isAcceptingOrders && isOpenNow(outlet.openingHours),
    paymentMethods: availablePaymentMethods(outlet),
    upiComingSoon: !outlet.upi?.vpa, // UPI is shown to customers even before the owner adds a UPI id / API
  };
}

// Reserve one use of a limited offer. The condition is checked inside the database update,
// so two customers cannot both take the last use.
async function reserveOffer(offer) {
  if (!offer) return;
  const reserved = await Offer.findOneAndUpdate(
    { _id: offer._id, isActive: true, $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    { $inc: { usedCount: 1 } }
  );
  if (!reserved) throw badRequest('This offer has been fully used', 'OFFER_INVALID');
}
const releaseOffer = (code) => (code ? Offer.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }) : null);

export async function createOrder({ user, body, ip }) {
  if (!user.name || !user.phone) throw badRequest('Please add your full name and contact number first', 'PROFILE_INCOMPLETE');
  // Same customer + same key = same order (double taps, flaky networks).
  const prior = await Order.findOne({ customer: user._id, idempotencyKey: body.idempotencyKey });
  if (prior) return { order: prior, existing: true };

  const { outlet, offer, bill } = await loadPricingContext(body, user._id);

  if (!outlet.isAcceptingOrders || !isOpenNow(outlet.openingHours)) {
    throw conflict('This cart is not taking orders right now', 'OUTLET_CLOSED');
  }
  if (!availablePaymentMethods(outlet).includes(body.paymentMethod)) {
    throw badRequest('This payment method is not available at this cart', 'PAYMENT_METHOD_UNAVAILABLE');
  }
  const activeCount = await Order.countDocuments({ customer: user._id, status: { $in: ACTIVE_ORDER_STATUSES } });
  if (activeCount >= MAX_ACTIVE_ORDERS_PER_CUSTOMER) {
    throw new AppError(429, 'You already have several active orders. Please wait for them to finish.', 'TOO_MANY_ACTIVE_ORDERS');
  }

  await reserveOffer(offer);

  const now = new Date();
  const seq = await nextSequence(`order:${outlet.code}:${dayKeyIST(now)}`);
  const orderNumber = formatOrderNumber(outlet.code, now, seq);
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const firstName = (user.name || '').trim().split(/\s+/)[0] || 'Customer';

  let order = null;
  for (let attempt = 0; attempt < 5 && !order; attempt += 1) {
    try {
      // The unique indexes on orderNumber and couponCode are the final guarantee against duplicates.
      order = await Order.create({
        _id: orderId, orderNumber, couponCode: generateCouponCode(),
        customer: user._id, customerName: firstName, outlet: outlet._id,
        items: bill.lines.map((l) => ({ product: l.productId, name: l.name, pricePaise: l.pricePaise, quantity: l.quantity, lineTotalPaise: l.lineTotalPaise })),
        instructions: body.instructions || '',
        subtotalPaise: bill.subtotalPaise, discountPaise: bill.discountPaise, offerCode: bill.offerCode || undefined,
        feePaise: bill.feePaise, taxPaise: bill.taxPaise, taxLabel: bill.taxLabel || undefined, totalPaise: bill.totalPaise,
        serviceType: body.serviceType, paymentMethod: body.paymentMethod, paymentStatus: 'Pending', payment: paymentId,
        status: 'Placed', statusHistory: [{ status: 'Placed', by: user._id, role: 'customer', at: now }],
        idempotencyKey: body.idempotencyKey,
      });
    } catch (err) {
      if (err?.code === 11000 && err.keyPattern?.couponCode) continue; // rare code clash: try a new code
      await releaseOffer(bill.offerCode);
      if (err?.code === 11000 && err.keyPattern?.idempotencyKey) {
        const again = await Order.findOne({ customer: user._id, idempotencyKey: body.idempotencyKey });
        if (again) return { order: again, existing: true };
      }
      throw err;
    }
  }
  if (!order) {
    await releaseOffer(bill.offerCode);
    throw new AppError(503, 'Could not create the order. Please try again.', 'ORDER_CREATE_FAILED');
  }

  try {
    await Payment.create({ _id: paymentId, order: order._id, outlet: outlet._id, method: body.paymentMethod, amountPaise: bill.totalPaise });
  } catch (err) {
    await Order.deleteOne({ _id: order._id });
    await releaseOffer(bill.offerCode);
    throw err;
  }

  audit(actorOf(user), 'order.create', 'Order', order._id, { orderNumber, method: body.paymentMethod, totalPaise: bill.totalPaise }, ip);
  emitOrderEvent('order:new', order);
  return { order, existing: false };
}

/**
 * The ONLY place an order's status changes. Checks: who you are, which orders you may touch,
 * whether the move is allowed, payment/coupon conditions, and finally applies it atomically.
 */
export async function changeOrderStatus({ orderId, toStatus, user, pin, reason, ip }) {
  const actor = actorOf(user);
  const order = await loadOrderForActor(orderId, actor);
  const fromStatus = order.status;

  const customerCancel = actor.role === 'customer' && toStatus === 'Cancelled';
  // Customers get a clear reason ("already accepted", "window passed") instead of a generic permission error.
  if (customerCancel) assertCustomerCanCancel(order, await getSettings());
  assertTransition(fromStatus, toStatus, actor.role);

  const guard = { _id: order._id, status: fromStatus };
  if (customerCancel) guard.paymentStatus = { $ne: 'Paid' };
  if (toStatus === 'Completed') {
    if (order.paymentStatus !== 'Paid') {
      throw conflict('Confirm the payment before completing this order', 'PAYMENT_NOT_CONFIRMED');
    }
    guard.paymentStatus = 'Paid';
    // Staff hand over food only against the customer's permanent 4-digit PIN. (An admin may override.)
    if (actor.role === 'staff' && env.completeNeedsPin) {
      const owner = await User.findById(order.customer);
      if (owner && ensurePin(owner)) await owner.save();
      if (!owner?.pin || String(pin || '').trim() !== owner.pin) throw badRequest('The PIN does not match this customer', 'PIN_MISMATCH');
    }
  }

  const set = { status: toStatus };
  if (toStatus === 'Cancelled') set.cancelledReason = reason || (actor.role === 'customer' ? 'Cancelled by customer' : 'Cancelled by cart');
  const updated = await Order.findOneAndUpdate(
    guard,
    { $set: set, $push: { statusHistory: { status: toStatus, by: user._id, role: actor.role, at: new Date(), note: reason } } },
    { new: true }
  );
  // Nothing matched: somebody else changed it a moment ago. Never apply a stale update.
  if (!updated) throw conflict('This order was just updated by someone else. Please refresh.', 'STATUS_CONFLICT');

  if (toStatus === 'Cancelled') {
    // An unpaid payment is closed. A PAID one stays Paid until the owner records a refund.
    const closed = await Payment.findOneAndUpdate({ order: order._id, status: { $in: ['Pending', 'Failed'] } }, { $set: { status: 'Cancelled' } });
    if (closed) await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'Cancelled' } });
    await releaseOffer(order.offerCode);
  }

  audit(actor, 'order.status', 'Order', order._id, { from: fromStatus, to: toStatus, reason }, ip);
  const fresh = await Order.findById(order._id);
  emitOrderEvent('order:updated', fresh);
  return fresh;
}
