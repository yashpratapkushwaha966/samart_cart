import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateOtp, hashOtp, checkOtp, OTP_MAX_ATTEMPTS } from '../../src/services/otp.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../../src/services/razorpay.js';

const pepper = 'test-pepper-test-pepper-test-pepper';

test('otp is 6 digits', () => {
  for (let i = 0; i < 500; i += 1) assert.match(generateOtp(), /^\d{6}$/);
});

test('otp check: correct, wrong, expired, consumed, too many attempts', () => {
  const now = new Date('2026-10-10T10:00:00Z');
  const rec = { codeHash: hashOtp('a@b.com', '123456', pepper), expiresAt: new Date('2026-10-10T10:05:00Z'), attempts: 0 };
  assert.deepEqual(checkOtp({ record: rec, email: 'A@B.com', otp: '123456', pepper, now }), { ok: true });
  assert.equal(checkOtp({ record: rec, email: 'a@b.com', otp: '000000', pepper, now }).reason, 'WRONG_CODE');
  assert.equal(checkOtp({ record: { ...rec, expiresAt: new Date('2026-10-10T09:59:00Z') }, email: 'a@b.com', otp: '123456', pepper, now }).reason, 'EXPIRED');
  assert.equal(checkOtp({ record: { ...rec, consumedAt: now }, email: 'a@b.com', otp: '123456', pepper, now }).reason, 'NO_CODE');
  assert.equal(checkOtp({ record: { ...rec, attempts: OTP_MAX_ATTEMPTS }, email: 'a@b.com', otp: '123456', pepper, now }).reason, 'TOO_MANY_ATTEMPTS');
  assert.equal(checkOtp({ record: null, email: 'a@b.com', otp: '1', pepper, now }).reason, 'NO_CODE');
});

test('otp hash depends on email and pepper', () => {
  assert.notEqual(hashOtp('a@b.com', '111111', pepper), hashOtp('c@d.com', '111111', pepper));
  assert.notEqual(hashOtp('a@b.com', '111111', pepper), hashOtp('a@b.com', '111111', 'other-pepper'));
});

test('razorpay checkout signature', () => {
  const secret = 'rzp_secret_example';
  const signature = crypto.createHmac('sha256', secret).update('order_X|pay_Y').digest('hex');
  assert.equal(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_Y', signature, secret }), true);
  assert.equal(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_Z', signature, secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_Y', signature: 'abc', secret }), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_Y', signature, secret: '' }), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_Y', signature: '', secret }), false);
});

test('razorpay webhook signature uses the raw body', () => {
  const secret = 'whsec_example';
  const raw = Buffer.from('{"event":"payment.captured","payload":{}}');
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature({ rawBody: raw, signature, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('{"event":"payment.captured", "payload":{}}'), signature, secret }), false);
  assert.equal(verifyWebhookSignature({ rawBody: raw, signature, secret: 'wrong' }), false);
  assert.equal(verifyWebhookSignature({ rawBody: undefined, signature, secret }), false);
});
