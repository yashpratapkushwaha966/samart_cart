import crypto from 'node:crypto';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { AppError, badRequest, conflict, notFound } from '../utils/AppError.js';
import { env, gatewayConfigured } from '../config/env.js';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from './razorpay.js';
import { loadOrderForActor, actorOf } from './orderAccess.js';
import { audit } from './audit.js';
import { emitOrderEvent, emitAdminAlert } from './realtime.js';
import { logger } from '../utils/logger.js';

async function alertAdmin(message, meta) {
  logger.warn(message, meta);
  audit(null, 'alert', 'Payment', meta?.orderId, { message, ...meta });
  emitAdminAlert(message, meta);
}

async function broadcast(orderId) {
  const fresh = await Order.findById(orderId);
  if (fresh) emitOrderEvent('order:updated', fresh);
  return fresh;
}
const mirror = (orderId, paymentStatus) => Order.updateOne({ _id: orderId }, { $set: { paymentStatus } });

/** Cash / UPI: an authorised person confirms they really received the money. Safe to call twice. */
export async function confirmManualPayment({ orderId, user, upiReference, ip }) {
  const actor = actorOf(user);
  const order = await loadOrderForActor(orderId, actor);
  if (order.paymentMethod === 'online') {
    throw badRequest('Online payments are confirmed automatically by the payment gateway', 'USE_GATEWAY');
  }
  if (order.status === 'Cancelled') throw conflict('This order is cancelled', 'ORDER_CANCELLED');
  if (order.paymentStatus === 'Paid') return order; // already confirmed: nothing to do

  const updated = await Payment.findOneAndUpdate(
    { order: order._id, status: 'Pending' },
    { $set: { status: 'Paid', confirmedBy: user._id, confirmedByRole: actor.role, confirmedAt: new Date(), ...(upiReference ? { upiReference } : {}) } },
    { new: true }
  );
  if (!updated) {
    const current = await Payment.findOne({ order: order._id });
    if (current?.status === 'Paid') return broadcast(order._id);
    throw conflict(`Payment cannot be confirmed (status: ${current?.status || 'unknown'})`, 'PAYMENT_STATE');
  }
  await mirror(order._id, 'Paid');
  audit(actor, 'payment.confirm', 'Order', order._id, { method: order.paymentMethod, amountPaise: order.totalPaise }, ip);
  return broadcast(order._id);
}

/** Owner records that a refund was paid back. (For online payments, refund from the Razorpay dashboard first.) */
export async function markRefunded({ orderId, user, note, ip }) {
  const actor = actorOf(user);
  const order = await loadOrderForActor(orderId, actor);
  const updated = await Payment.findOneAndUpdate(
    { order: order._id, status: 'Paid' },
    { $set: { status: 'Refunded', refundedAt: new Date(), refundNote: note } },
    { new: true }
  );
  if (!updated) throw conflict('Only a paid payment can be marked as refunded', 'PAYMENT_STATE');
  await mirror(order._id, 'Refunded');
  audit(actor, 'payment.refund', 'Order', order._id, { amountPaise: updated.amountPaise, note }, ip);
  return broadcast(order._id);
}

// ---------------- online (Razorpay) ----------------

/** Step 1: the SERVER creates the payment order. The browser only receives the public key id. */
export async function createGatewayOrder({ orderId, user }) {
  if (!gatewayConfigured()) throw new AppError(503, 'Online payment is not set up yet', 'GATEWAY_NOT_CONFIGURED');
  const order = await loadOrderForActor(orderId, actorOf(user));
  if (order.paymentMethod !== 'online') throw badRequest('This order was not placed with online payment', 'WRONG_METHOD');
  if (order.status === 'Cancelled') throw conflict('This order is cancelled', 'ORDER_CANCELLED');
  if (order.totalPaise < 100) throw badRequest('Amount is too small for online payment', 'AMOUNT_TOO_SMALL');

  let payment = await Payment.findOne({ order: order._id });
  if (!payment) throw notFound('Payment record not found');
  if (payment.status === 'Paid') throw conflict('This order is already paid', 'ALREADY_PAID');
  if (payment.status === 'Failed') { // customer is trying again on the same gateway order
    await Payment.updateOne({ _id: payment._id, status: 'Failed' }, { $set: { status: 'Pending' } });
    await mirror(order._id, 'Pending');
  }

  if (!payment.gatewayOrderId) {
    let rp;
    try {
      rp = await createRazorpayOrder({
        keyId: env.razorpay.keyId, keySecret: env.razorpay.keySecret,
        amountPaise: order.totalPaise, receipt: order.orderNumber, notes: { orderId: String(order._id) },
      });
    } catch (err) {
      logger.error('razorpay order create failed', { orderId: String(order._id), error: err.message });
      throw new AppError(502, 'Could not start the payment. Please try again.', 'GATEWAY_ERROR');
    }
    // If two taps raced, only the first write wins and both use the same gateway order.
    await Payment.updateOne({ _id: payment._id, gatewayOrderId: { $exists: false } }, { $set: { gatewayOrderId: rp.id, provider: 'razorpay' } });
    payment = await Payment.findById(payment._id);
  }
  return {
    keyId: env.razorpay.keyId, gatewayOrderId: payment.gatewayOrderId, amountPaise: order.totalPaise,
    currency: 'INR', orderNumber: order.orderNumber,
  };
}

/**
 * Marks an online payment as paid. Used by BOTH the checkout callback and the webhook,
 * so whichever arrives first wins and the other one is harmlessly ignored.
 */
export async function markOnlinePaid({ gatewayOrderId, gatewayPaymentId, amountPaise }) {
  const payment = await Payment.findOne({ gatewayOrderId });
  if (!payment) return { result: 'unknown_order' };
  if (amountPaise != null && Number(amountPaise) !== payment.amountPaise) {
    await alertAdmin('Payment amount mismatch. Not marked as paid.', { orderId: String(payment.order), gatewayPaymentId, expected: payment.amountPaise, received: amountPaise });
    return { result: 'amount_mismatch' };
  }
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['Pending', 'Failed', 'Cancelled'] } },
    { $set: { status: 'Paid', gatewayPaymentId, confirmedAt: new Date(), confirmedByRole: 'gateway' } },
    { new: true }
  );
  if (updated) {
    await mirror(payment.order, 'Paid');
    const order = await broadcast(payment.order);
    if (order?.status === 'Cancelled') {
      await alertAdmin('Money was received for a CANCELLED order. Please refund it.', { orderId: String(payment.order), gatewayPaymentId });
    }
    return { result: 'paid' };
  }
  const current = await Payment.findById(payment._id);
  if (current.status === 'Paid' && current.gatewayPaymentId === gatewayPaymentId) return { result: 'already_paid' };
  if (current.status === 'Paid') {
    await Payment.updateOne({ _id: current._id }, { $addToSet: { duplicatePaymentIds: gatewayPaymentId } });
    await alertAdmin('A second payment was received for an already-paid order. Please refund it.', { orderId: String(current.order), gatewayPaymentId });
    return { result: 'duplicate_payment' };
  }
  return { result: `ignored_${current.status}` };
}

/** Step 2: browser reports success. We trust only the signature check done with our secret key. */
export async function verifyGatewayPayment({ user, orderId, razorpayOrderId, razorpayPaymentId, signature }) {
  const order = await loadOrderForActor(orderId, actorOf(user));
  const payment = await Payment.findOne({ order: order._id });
  if (!payment || !payment.gatewayOrderId || payment.gatewayOrderId !== razorpayOrderId) {
    throw badRequest('Payment does not match this order', 'PAYMENT_MISMATCH');
  }
  const valid = verifyPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature, secret: env.razorpay.keySecret });
  if (!valid) {
    await alertAdmin('Payment signature check FAILED.', { orderId: String(order._id), razorpayPaymentId });
    throw badRequest('Payment could not be verified', 'BAD_SIGNATURE');
  }
  await markOnlinePaid({ gatewayOrderId: razorpayOrderId, gatewayPaymentId: razorpayPaymentId });
  audit(actorOf(user), 'payment.verify', 'Order', order._id, { via: 'checkout' });
  return Order.findById(order._id);
}

/** Razorpay -> our server. Signed, de-duplicated by event id, and safe to receive many times. */
export async function handleRazorpayWebhook({ rawBody, signature, eventId }) {
  if (!verifyWebhookSignature({ rawBody, signature, secret: env.razorpay.webhookSecret })) {
    throw badRequest('Invalid webhook signature', 'BAD_SIGNATURE');
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const id = eventId || crypto.createHash('sha256').update(rawBody).digest('hex');
  try {
    await WebhookEvent.create({ eventId: id, type: event.event });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }

  try {
    const pay = event.payload?.payment?.entity;
    switch (event.event) {
      case 'payment.captured':
      case 'order.paid':
        if (pay?.order_id && pay?.id && (pay.status === 'captured' || event.event === 'order.paid')) {
          await markOnlinePaid({ gatewayOrderId: pay.order_id, gatewayPaymentId: pay.id, amountPaise: pay.amount });
        }
        break;
      case 'payment.failed': {
        const failed = await Payment.findOneAndUpdate({ gatewayOrderId: pay?.order_id, status: 'Pending' }, { $set: { status: 'Failed' } });
        if (failed) { await mirror(failed.order, 'Failed'); await broadcast(failed.order); }
        break;
      }
      case 'refund.processed': {
        const refund = event.payload?.refund?.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: refund?.payment_id });
        if (payment && refund.amount === payment.amountPaise) {
          await Payment.updateOne({ _id: payment._id, status: 'Paid' }, { $set: { status: 'Refunded', refundedAt: new Date(), refundNote: 'Refunded via gateway' } });
          await mirror(payment.order, 'Refunded');
          await broadcast(payment.order);
        } else if (payment) {
          await alertAdmin('A partial refund was processed. Please review this order.', { orderId: String(payment.order) });
        }
        break;
      }
      default: break; // other events are ignored on purpose
    }
  } catch (err) {
    await WebhookEvent.deleteOne({ eventId: id }); // let Razorpay retry later
    throw err;
  }
  return { duplicate: false };
}
