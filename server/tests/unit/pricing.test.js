import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBill, evaluateOffer } from '../../src/services/pricing.js';

const products = new Map([
  ['p1', { name: 'Veg Momos', pricePaise: 6000, isActive: true, isAvailable: true }],
  ['p2', { name: 'Paneer Momos', pricePaise: 9000, isActive: true, isAvailable: true }],
  ['p3', { name: 'Sold Out Momos', pricePaise: 7000, isActive: true, isAvailable: false }],
  ['p4', { name: 'Other Cart Only', pricePaise: 7000, isActive: true, isAvailable: true, unavailableAtOutlets: ['outA'] }],
]);
const base = { productsById: products, outletId: 'outA' };

test('bill uses server prices and sums correctly', () => {
  const bill = computeBill({ ...base, items: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }] });
  assert.equal(bill.subtotalPaise, 21000);
  assert.equal(bill.totalPaise, 21000);
  assert.equal(bill.lines[0].pricePaise, 6000);
});

test('duplicate lines are merged', () => {
  const bill = computeBill({ ...base, items: [{ productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 3 }] });
  assert.equal(bill.lines.length, 1);
  assert.equal(bill.lines[0].quantity, 5);
});

test('rejects bad quantities, empty carts, unavailable products', () => {
  assert.throws(() => computeBill({ ...base, items: [] }), { code: 'EMPTY_CART' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p1', quantity: 0 }] }), { code: 'BAD_QUANTITY' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p1', quantity: 1.5 }] }), { code: 'BAD_QUANTITY' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p1', quantity: 21 }] }), { code: 'BAD_QUANTITY' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p1', quantity: 15 }, { productId: 'p1', quantity: 15 }] }), { code: 'BAD_QUANTITY' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p3', quantity: 1 }] }), { code: 'PRODUCT_UNAVAILABLE' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'nope', quantity: 1 }] }), { code: 'PRODUCT_UNAVAILABLE' });
  assert.throws(() => computeBill({ ...base, items: [{ productId: 'p4', quantity: 1 }] }), { code: 'PRODUCT_UNAVAILABLE' });
});

const offer = (o = {}) => ({ code: 'WELCOME10', isActive: true, type: 'percent', value: 10, minOrderPaise: 10000, maxDiscountPaise: 5000, usageLimit: 0, usedCount: 0, perUserLimit: 1, ...o });
const now = new Date('2026-10-10T10:00:00Z');

test('percent offer with cap', () => {
  const items = [{ productId: 'p2', quantity: 10 }]; // 90000
  const bill = computeBill({ ...base, items, offer: offer(), now });
  assert.equal(bill.discountPaise, 5000); // 10% = 9000 but capped at 5000
  assert.equal(bill.totalPaise, 85000);
  assert.equal(bill.offerCode, 'WELCOME10');
});

test('flat offer never exceeds the eligible amount', () => {
  const bill = computeBill({ ...base, items: [{ productId: 'p1', quantity: 2 }], offer: offer({ type: 'flat', value: 50000, minOrderPaise: 0 }), now });
  assert.equal(bill.discountPaise, 12000);
  assert.equal(bill.totalPaise, 0);
});

test('offer rules: expiry, start, min order, limits, per-user, eligible products', () => {
  const lines = [{ productId: 'p1', lineTotalPaise: 12000 }];
  const ctx = { lines, subtotalPaise: 12000, now };
  assert.throws(() => evaluateOffer(offer({ expiresAt: new Date('2026-10-09T00:00:00Z') }), ctx), /expired/);
  assert.throws(() => evaluateOffer(offer({ startsAt: new Date('2026-10-11T00:00:00Z') }), ctx), /not started/);
  assert.throws(() => evaluateOffer(offer({ minOrderPaise: 20000 }), ctx), /more to use/);
  assert.throws(() => evaluateOffer(offer({ usageLimit: 5, usedCount: 5 }), ctx), /fully used/);
  assert.throws(() => evaluateOffer(offer(), { ...ctx, userOfferUses: 1 }), /already used/);
  assert.throws(() => evaluateOffer(offer({ isActive: false }), ctx), /not valid/);
  assert.throws(() => evaluateOffer(offer({ eligibleProductIds: ['p2'] }), ctx), /does not apply/);
  assert.equal(evaluateOffer(offer({ eligibleProductIds: ['p1'] }), ctx), 1200);
});

test('tax is off by default and configurable; packaging fee added', () => {
  const items = [{ productId: 'p1', quantity: 2 }]; // 12000
  assert.equal(computeBill({ ...base, items, settings: { packagingFeePaise: 500 } }).totalPaise, 12500);
  const taxed = computeBill({ ...base, items, settings: { taxEnabled: true, taxPercent: 5, taxLabel: 'GST', packagingFeePaise: 0 } });
  assert.equal(taxed.taxPaise, 600);
  assert.equal(taxed.totalPaise, 12600);
  assert.equal(taxed.taxLabel, 'GST');
});

test('all money values are integers', () => {
  const bill = computeBill({ ...base, items: [{ productId: 'p1', quantity: 3 }], offer: offer({ value: 7, minOrderPaise: 0 }), settings: { taxEnabled: true, taxPercent: 5 }, now });
  for (const k of ['subtotalPaise', 'discountPaise', 'taxPaise', 'totalPaise']) assert.ok(Number.isInteger(bill[k]), k);
});
