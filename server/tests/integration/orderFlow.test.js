// Full-stack test: real Express app + real (in-memory) MongoDB. Requires `npm install` first.
//   npm run test:integration
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.APP_SECRET = 'integration-test-secret-integration-test-secret';
process.env.MONGODB_URI = 'unused-in-tests';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';

const { default: request } = await import('supertest');
const { MongoMemoryServer } = await import('mongodb-memory-server');
const bcrypt = (await import('bcryptjs')).default;
const mongoose = (await import('mongoose')).default;
const { connectDb, disconnectDb } = await import('../../src/config/db.js');
const M = await import('../../src/models/index.js');
const { createApp } = await import('../../src/app.js');
const { testOutbox } = await import('../../src/services/mailer.js');

const H = { 'X-Requested-With': 'XMLHttpRequest' };
let mongod; let app; const ids = {};
const call = (agent, method, url, body) => agent[method](`/api/v1${url}`).set(H).send(body);
const newAgent = () => request.agent(app);

const WHO = { name: 'Test Customer', phone: '9876543210' };
async function loginCustomer(email) {
  const a = newAgent();
  assert.equal((await call(a, 'post', '/auth/otp/request', { email, ...WHO })).status, 200);
  const res = await call(a, 'post', '/auth/otp/verify', { email, code: testOutbox.get(email), ...WHO });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return a;
}
async function loginPassword(email, password) {
  const a = newAgent();
  const res = await call(a, 'post', '/auth/login', { email, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return a;
}
const orderBody = (over = {}) => ({
  outletSlug: 'cart-a', items: [{ productId: String(ids.veg), quantity: 2 }, { productId: String(ids.paneer), quantity: 1 }],
  serviceType: 'dine_in', paymentMethod: 'cash', idempotencyKey: crypto.randomUUID(), ...over,
});
const status = (agent, id, s, extra = {}) => call(agent, 'patch', `/staff/orders/${id}/status`, { status: s, ...extra });

before(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  app = createApp();

  const outA = await M.Outlet.create({ name: 'Cart A', code: 'CTA', slug: 'cart-a', upi: { vpa: 'carta@okaxis' } });
  const outB = await M.Outlet.create({ name: 'Cart B', code: 'CTB', slug: 'cart-b' });
  const cat = await M.Category.create({ name: 'Steamed', slug: 'steamed' });
  ids.veg = (await M.Product.create({ name: 'Veg Momos', pricePaise: 6000, category: cat._id }))._id;
  ids.paneer = (await M.Product.create({ name: 'Paneer Momos', pricePaise: 9000, category: cat._id }))._id;
  ids.off = (await M.Product.create({ name: 'Sold Out', pricePaise: 5000, category: cat._id, isAvailable: false }))._id;
  await M.Offer.create({ code: 'WELCOME10', title: '10%', type: 'percent', value: 10, minOrderPaise: 10000, maxDiscountPaise: 5000, perUserLimit: 1 });
  await M.Offer.create({ code: 'ONLYONE', title: 'Once', type: 'flat', value: 1000, usageLimit: 1, perUserLimit: 0 });
  const hash = await bcrypt.hash('password-1234', 4);
  await M.User.create({ name: 'Owner', email: 'owner@test.com', role: 'admin', passwordHash: hash });
  await M.User.create({ name: 'Staff A', email: 'staffa@test.com', role: 'staff', outletIds: [outA._id], passwordHash: hash });
  await M.User.create({ name: 'Staff B', email: 'staffb@test.com', role: 'staff', outletIds: [outB._id], passwordHash: hash });
});
after(async () => { await disconnectDb(); await mongod?.stop(); });

test('requests without the anti-CSRF header are blocked', async () => {
  const res = await newAgent().post('/api/v1/auth/logout').send({});
  assert.equal(res.status, 403);
});

test('public menu is readable without login and has no private data', async () => {
  const res = await newAgent().get('/api/v1/public/outlets/cart-a/menu');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.products.length, 3);
  assert.equal(res.body.data.outlet.paymentMethods.includes('upi'), true);
  assert.equal(JSON.stringify(res.body).includes('carta@okaxis'), false);
});

test('complete order flow: customer -> staff -> admin', async () => {
  const cust = await loginCustomer('ravi@test.com');
  const staff = await loginPassword('staffa@test.com', 'password-1234');
  const admin = await loginPassword('owner@test.com', 'password-1234');

  // client-supplied price is ignored; total comes from the database
  const body = orderBody();
  body.items[0].pricePaise = 1;
  const created = await call(cust, 'post', '/orders', body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = created.body.data.order;
  assert.equal(order.totalPaise, 21000);
  assert.match(order.orderNumber, /^CTA-\d{8}-0001$/);
  assert.equal(order.couponCode, undefined); // there is no per-order code any more; pickup uses the permanent PIN
  assert.equal(order.status, 'Placed');
  assert.equal(order.paymentStatus, 'Pending');

  // double tap with the same key returns the SAME order
  const again = await call(cust, 'post', '/orders', body);
  assert.equal(again.status, 200);
  assert.equal(again.body.data.order.id, order.id);
  assert.equal(await M.Order.countDocuments(), 1);

  // staff sees it, but not the customer's email
  const queue = await call(staff, 'get', '/staff/orders?scope=active');
  assert.equal(queue.body.data.orders.length, 1);
  assert.equal(JSON.stringify(queue.body).includes('ravi@test.com'), false);
  assert.equal(queue.body.data.orders[0].customerName, 'Test'); // first name only
  assert.equal(queue.body.data.orders[0].serviceType, 'dine_in');

  // invalid jumps are refused
  assert.equal((await status(staff, order.id, 'Completed')).body.error.code, 'INVALID_TRANSITION');
  assert.equal((await status(staff, order.id, 'Ready')).body.error.code, 'INVALID_TRANSITION');

  assert.equal((await status(staff, order.id, 'Accepted')).status, 200);
  assert.equal((await status(staff, order.id, 'Preparing')).status, 200);
  assert.equal((await status(staff, order.id, 'Ready')).status, 200);

  // cannot complete before payment is confirmed
  const early = await status(staff, order.id, 'Completed');
  assert.equal(early.body.error.code, 'PAYMENT_NOT_CONFIRMED');

  // confirm cash (twice: second call changes nothing)
  assert.equal((await call(staff, 'post', `/staff/orders/${order.id}/confirm-payment`, {})).status, 200);
  assert.equal((await call(staff, 'post', `/staff/orders/${order.id}/confirm-payment`, {})).status, 200);
  assert.equal(await M.Payment.countDocuments({ status: 'Paid' }), 1);

  // staff need the customer's permanent PIN. They never see it on their screen
  const pin = (await call(cust, 'get', '/auth/me')).body.data.user.pin;
  assert.match(pin, /^\d{4}$/);
  assert.equal((await status(staff, order.id, 'Completed')).body.error.code, 'PIN_MISMATCH');
  assert.equal((await status(staff, order.id, 'Completed', { pin: pin === '7391' ? '7392' : '7391' })).body.error.code, 'PIN_MISMATCH');
  const done = await status(staff, order.id, 'Completed', { pin });
  assert.equal(done.status, 200, JSON.stringify(done.body));

  // customer sees the final state, admin reports use the real payment
  const mine = await call(cust, 'get', `/orders/${order.id}`);
  assert.equal(mine.body.data.order.status, 'Completed');
  assert.equal(mine.body.data.order.paymentStatus, 'Paid');
  const dash = await call(admin, 'get', '/admin/dashboard');
  assert.equal(dash.status, 200, JSON.stringify(dash.body));
  assert.equal(dash.body.data.sales.today.totalPaise, 21000);
  assert.equal(dash.body.data.sales.today.byMethod.cash, 21000);
  assert.equal(dash.body.data.counts.completedToday, 1);
  assert.equal(dash.body.data.popular[0].name, 'Veg Momos');
});

test('permissions: customers, staff of another cart, and staff vs admin routes', async () => {
  const a = await loginCustomer('amit@test.com');
  const b = await loginCustomer('bina@test.com');
  const staffA = await loginPassword('staffa@test.com', 'password-1234');
  const staffB = await loginPassword('staffb@test.com', 'password-1234');

  const o = (await call(a, 'post', '/orders', orderBody())).body.data.order;
  assert.equal((await call(b, 'get', `/orders/${o.id}`)).status, 404); // not yours
  assert.equal((await call(b, 'post', `/orders/${o.id}/cancel`)).status, 404);
  assert.equal((await call(staffB, 'get', '/staff/orders?scope=active')).body.data.orders.length, 0);
  assert.equal((await status(staffB, o.id, 'Accepted')).status, 404); // other cart's order
  assert.equal((await call(staffA, 'get', '/admin/dashboard')).status, 403);
  assert.equal((await call(staffA, 'post', '/admin/products', { name: 'X', pricePaise: 100, category: String(new mongoose.Types.ObjectId()) })).status, 403);
  assert.equal((await call(a, 'get', '/staff/orders')).status, 403);
  assert.equal((await call(a, 'get', '/admin/orders')).status, 403);
  assert.equal((await call(newAgent(), 'get', '/orders')).status, 401);
  // a customer cannot move their own order forward
  assert.equal((await call(a, 'patch', `/staff/orders/${o.id}/status`, { status: 'Accepted' })).status, 403);
});

test('one active session per customer: a new login logs out the old device', async () => {
  const phone = await loginCustomer('multi@test.com');
  assert.ok((await call(phone, 'get', '/auth/me')).body.data.user);
  const laptop = await loginCustomer('multi@test.com');
  assert.ok((await call(laptop, 'get', '/auth/me')).body.data.user);
  assert.equal((await call(phone, 'get', '/auth/me')).body.data.user, null);
});

test('a role cannot be chosen at sign-up and staff/admin cannot use OTP', async () => {
  const a = newAgent();
  await call(a, 'post', '/auth/otp/request', { email: 'sneaky@test.com', role: 'admin', ...WHO });
  const res = await call(a, 'post', '/auth/otp/verify', { email: 'sneaky@test.com', code: testOutbox.get('sneaky@test.com'), role: 'admin', ...WHO });
  assert.equal(res.body.data.user.role, 'customer');
  await call(newAgent(), 'post', '/auth/otp/request', { email: 'owner@test.com', ...WHO });
  assert.equal(testOutbox.has('owner@test.com'), false);
});

test('OTP: wrong code is rejected, a used code cannot be reused', async () => {
  const email = 'otp@test.com';
  await call(newAgent(), 'post', '/auth/otp/request', { email, ...WHO });
  const real = testOutbox.get(email);
  const wrong = real === '000000' ? '111111' : '000000';
  assert.equal((await call(newAgent(), 'post', '/auth/otp/verify', { email, code: wrong, ...WHO })).status, 400);
  assert.equal((await call(newAgent(), 'post', '/auth/otp/verify', { email, code: real, ...WHO })).status, 200);
  assert.equal((await call(newAgent(), 'post', '/auth/otp/verify', { email, code: real, ...WHO })).status, 400);
});

test('customer cancellation rules', async () => {
  const c = await loginCustomer('cancel@test.com');
  const staff = await loginPassword('staffa@test.com', 'password-1234');
  const o1 = (await call(c, 'post', '/orders', orderBody())).body.data.order;
  assert.equal(o1.permissions.canCancel, true);
  assert.equal((await call(c, 'post', `/orders/${o1.id}/cancel`)).body.data.order.status, 'Cancelled');
  const o2 = (await call(c, 'post', '/orders', orderBody())).body.data.order;
  await status(staff, o2.id, 'Accepted');
  assert.equal((await call(c, 'post', `/orders/${o2.id}/cancel`)).body.error.code, 'CANCEL_NOT_ALLOWED');
});

test('offers: discount applied on the server, per-user and total limits enforced', async () => {
  const c = await loginCustomer('offer@test.com');
  const o = await call(c, 'post', '/orders', orderBody({ offerCode: 'WELCOME10' }));
  assert.equal(o.body.data.order.discountPaise, 2100);
  assert.equal(o.body.data.order.totalPaise, 18900);
  assert.equal((await call(c, 'post', '/orders', orderBody({ offerCode: 'WELCOME10' }))).body.error.code, 'OFFER_INVALID');
  const d = await loginCustomer('offer2@test.com');
  const e = await loginCustomer('offer3@test.com');
  assert.equal((await call(d, 'post', '/orders', orderBody({ offerCode: 'ONLYONE' }))).status, 201);
  assert.equal((await call(e, 'post', '/orders', orderBody({ offerCode: 'ONLYONE' }))).body.error.code, 'OFFER_INVALID');
});

test('bad orders are rejected: unavailable product, empty cart, closed cart, unavailable payment method', async () => {
  const c = await loginCustomer('bad@test.com');
  assert.equal((await call(c, 'post', '/orders', orderBody({ items: [{ productId: String(ids.off), quantity: 1 }] }))).body.error.code, 'PRODUCT_UNAVAILABLE');
  assert.equal((await call(c, 'post', '/orders', orderBody({ items: [] }))).status, 400);
  assert.equal((await call(c, 'post', '/orders', orderBody({ outletSlug: 'cart-b', paymentMethod: 'upi' }))).body.error.code, 'PAYMENT_METHOD_UNAVAILABLE');
  await M.Outlet.updateOne({ slug: 'cart-b' }, { isAcceptingOrders: false });
  assert.equal((await call(c, 'post', '/orders', orderBody({ outletSlug: 'cart-b' }))).body.error.code, 'OUTLET_CLOSED');
});

test('UPI order stays Pending until staff verifies it', async () => {
  const c = await loginCustomer('upi@test.com');
  const staff = await loginPassword('staffa@test.com', 'password-1234');
  const o = (await call(c, 'post', '/orders', orderBody({ paymentMethod: 'upi' }))).body.data.order;
  const info = await call(c, 'get', `/orders/${o.id}/upi`);
  assert.equal(info.status, 200);
  assert.match(info.body.data.uri, /^upi:\/\/pay\?pa=carta%40okaxis&pn=.*&am=210\.00&cu=INR/);
  assert.equal(info.body.data.paymentStatus, 'Pending');
  assert.equal((await call(c, 'get', `/orders/${o.id}`)).body.data.order.paymentStatus, 'Pending'); // clicking/viewing never marks it paid
  await call(staff, 'post', `/staff/orders/${o.id}/confirm-payment`, { upiReference: 'UTR123456' });
  assert.equal((await call(c, 'get', `/orders/${o.id}`)).body.data.order.paymentStatus, 'Paid');
});

test('online payment: signature checks, webhook de-duplication, amount mismatch, duplicate charge', async () => {
  const c = await loginCustomer('online@test.com');
  const o = (await call(c, 'post', '/orders', orderBody({ paymentMethod: 'online' }))).body.data.order;
  await M.Payment.updateOne({ order: o.id }, { gatewayOrderId: 'order_TEST1', provider: 'razorpay' });
  const sign = (s) => crypto.createHmac('sha256', 'rzp_test_secret').update(s).digest('hex');

  // forged checkout callback
  const forged = await call(c, 'post', '/payments/online/verify', { orderId: o.id, razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_FAKE1', razorpay_signature: 'f'.repeat(64) });
  assert.equal(forged.body.error.code, 'BAD_SIGNATURE');
  assert.equal((await M.Payment.findOne({ order: o.id })).status, 'Pending');

  // webhooks: bad signature, wrong amount, correct
  const hook = (event, id, sig) => {
    const raw = JSON.stringify(event);
    return request(app).post('/api/v1/payments/webhook/razorpay').set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', id).set('x-razorpay-signature', sig ?? crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex')).send(raw);
  };
  const captured = (amount, payId = 'pay_REAL1') => ({ event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: 'order_TEST1', amount, status: 'captured' } } } });
  assert.equal((await hook(captured(21000), 'evt_bad', 'deadbeef')).status, 400);
  await hook(captured(100), 'evt_amount');
  assert.equal((await M.Payment.findOne({ order: o.id })).status, 'Pending'); // wrong amount never marks paid
  assert.equal((await hook(captured(21000), 'evt_ok')).status, 200);
  assert.equal((await M.Payment.findOne({ order: o.id })).status, 'Paid');
  assert.equal((await M.Order.findById(o.id)).paymentStatus, 'Paid');

  // same event delivered again: ignored. A different payment id for the same order is flagged for refund.
  assert.equal((await hook(captured(21000), 'evt_ok')).status, 200);
  await hook(captured(21000, 'pay_SECOND'), 'evt_dup');
  const p = await M.Payment.findOne({ order: o.id });
  assert.equal(p.gatewayPaymentId, 'pay_REAL1');
  assert.deepEqual(p.duplicatePaymentIds, ['pay_SECOND']);
  assert.equal(await M.WebhookEvent.countDocuments({ eventId: 'evt_ok' }), 1);

  // the checkout callback arriving late with a valid signature is harmless
  const late = await call(c, 'post', '/payments/online/verify', { orderId: o.id, razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_REAL1', razorpay_signature: sign('order_TEST1|pay_REAL1') });
  assert.equal(late.status, 200);
  assert.equal(late.body.data.order.paymentStatus, 'Paid');
});

test('refund can only be recorded for a paid order, and only by an admin', async () => {
  const c = await loginCustomer('refund@test.com');
  const staff = await loginPassword('staffa@test.com', 'password-1234');
  const admin = await loginPassword('owner@test.com', 'password-1234');
  const o = (await call(c, 'post', '/orders', orderBody())).body.data.order;
  assert.equal((await call(admin, 'post', `/admin/orders/${o.id}/refund`, {})).body.error.code, 'PAYMENT_STATE');
  await call(staff, 'post', `/staff/orders/${o.id}/confirm-payment`, {});
  assert.equal((await call(staff, 'post', `/admin/orders/${o.id}/refund`, {})).status, 403);
  const r = await call(admin, 'post', `/admin/orders/${o.id}/refund`, { note: 'Customer left' });
  assert.equal(r.body.data.order.paymentStatus, 'Refunded');
});

test('name and contact number are compulsory; service type is required', async () => {
  const a = newAgent();
  assert.equal((await call(a, 'post', '/auth/otp/request', { email: 'noname@test.com' })).status, 400);
  assert.equal((await call(a, 'post', '/auth/otp/request', { email: 'noname@test.com', name: 'No Phone' })).status, 400);
  const c = await loginCustomer('profile@test.com');
  const me = (await call(c, 'get', '/auth/me')).body.data.user;
  assert.equal(me.name, 'Test Customer'); assert.equal(me.phone, '9876543210');
  const { serviceType, ...noService } = orderBody();
  assert.equal((await call(c, 'post', '/orders', noService)).status, 400);
  const o = await call(c, 'post', '/orders', orderBody({ serviceType: 'takeaway' }));
  assert.equal(o.body.data.order.serviceType, 'takeaway');
});

test('a customer without name/phone (e.g. Google sign-in) cannot place an order', async () => {
  const c = await loginCustomer('incomplete@test.com');
  await M.User.updateOne({ email: 'incomplete@test.com' }, { $unset: { phone: 1 } });
  assert.equal((await call(c, 'post', '/orders', orderBody())).body.error.code, 'PROFILE_INCOMPLETE');
});

test('each customer has one permanent 4-digit PIN that never changes and is never shown to staff', async () => {
  const email = 'pin@test.com';
  const a = await loginCustomer(email);
  const first = (await call(a, 'get', '/auth/me')).body.data.user.pin;
  assert.match(first, /^\d{4}$/);
  assert.notEqual(first, '0000');
  await call(a, 'post', '/auth/logout');
  const b = await loginCustomer(email);
  assert.equal((await call(b, 'get', '/auth/me')).body.data.user.pin, first); // same PIN after logging in again
  const staff = await loginPassword('staffa@test.com', 'password-1234');
  const queue = await call(staff, 'get', '/staff/orders');
  assert.equal(JSON.stringify(queue.body).includes('"pin"'), false);
  const adminMe = await call(await loginPassword('owner@test.com', 'password-1234'), 'get', '/auth/me');
  assert.equal('pin' in adminMe.body.data.user, false); // only customers have a PIN
});

test('feedback: anyone can send it, only the owner can read it', async () => {
  const guest = newAgent();
  assert.equal((await call(guest, 'post', '/public/feedback', { rating: 0, message: 'hello there' })).status, 400);
  assert.equal((await call(guest, 'post', '/public/feedback', { rating: 5, message: 'x' })).status, 400);
  assert.equal((await call(guest, 'post', '/public/feedback', { rating: 5, message: 'Great momos!', name: 'Asha Verma' })).status, 201);
  const cust = await loginCustomer('fb@test.com');
  assert.equal((await call(cust, 'post', '/public/feedback', { rating: 4, message: 'Tasty, a bit slow' })).status, 201);
  assert.equal((await call(cust, 'get', '/admin/feedback')).status, 403);
  const admin = await loginPassword('owner@test.com', 'password-1234');
  const list = await call(admin, 'get', '/admin/feedback');
  assert.equal(list.body.data.count, 2);
  assert.equal(list.body.data.average, 4.5);
  assert.ok(list.body.data.items.some((i) => i.name === 'Asha'));
});
