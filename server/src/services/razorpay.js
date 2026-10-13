import crypto from 'node:crypto';

const eq = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

// Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function verifyPaymentSignature({ orderId, paymentId, signature, secret }) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return eq(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw request body, webhook_secret). Must use the RAW bytes.
export function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return eq(expected, signature);
}

// Creates a payment order on Razorpay's server. Amount is in paise.
export async function createRazorpayOrder({ keyId, keySecret, amountPaise, receipt, notes = {} }) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.description || `Razorpay error ${res.status}`);
    err.gatewayStatus = res.status;
    throw err;
  }
  return body; // { id, amount, currency, ... }
}
