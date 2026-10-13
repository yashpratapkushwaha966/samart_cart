import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { createGatewayOrder, verifyGatewayPayment, handleRazorpayWebhook } from '../services/paymentService.js';
import { serializeOrder } from '../services/serializers.js';
import { getSettings } from '../services/settings.js';

export const createOnline = asyncHandler(async (req, res) =>
  ok(res, await createGatewayOrder({ orderId: req.valid.body.orderId, user: req.user })));

export const verifyOnline = asyncHandler(async (req, res) => {
  const b = req.valid.body;
  const order = await verifyGatewayPayment({
    user: req.user, orderId: b.orderId, razorpayOrderId: b.razorpay_order_id,
    razorpayPaymentId: b.razorpay_payment_id, signature: b.razorpay_signature,
  });
  return ok(res, { order: serializeOrder(order, 'customer', { settings: await getSettings() }) });
});

// Mounted with express.raw() so the signature is checked against the exact bytes Razorpay sent.
export const razorpayWebhook = asyncHandler(async (req, res) => {
  await handleRazorpayWebhook({
    rawBody: req.body, signature: req.get('x-razorpay-signature'), eventId: req.get('x-razorpay-event-id'),
  });
  return res.status(200).json({ received: true });
});
