import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCouponCode, normalizeCode, formatOrderNumber } from '../../src/utils/codes.js';
import { startOfDayIST, isOpenNow, dayKeyIST } from '../../src/utils/time.js';
import { buildUpiUri } from '../../src/services/upi.js';

test('coupon codes: right length, no ambiguous characters, effectively unique', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i += 1) {
    const c = generateCouponCode();
    assert.match(c, /^[A-HJ-KM-NP-Z2-9]{6}$/);
    seen.add(c);
  }
  assert.ok(seen.size > 4990, `too many collisions: ${seen.size}`);
});

test('normalizeCode ignores case, spaces and dashes', () => {
  assert.equal(normalizeCode(' ab3-k9z '), 'AB3K9Z');
  assert.equal(normalizeCode(null), '');
});

test('order number uses the IST date, not UTC', () => {
  // 20:00 UTC on 10 Oct is already 01:30 on 11 Oct in India
  assert.equal(formatOrderNumber('SMC', new Date('2026-10-10T20:00:00Z'), 7), 'SMC-20261011-0007');
  assert.equal(formatOrderNumber('SMC', new Date('2026-10-10T05:00:00Z'), 12345), 'SMC-20261010-12345');
});

test('startOfDayIST', () => {
  assert.equal(startOfDayIST(new Date('2026-10-10T20:00:00Z')).toISOString(), '2026-10-10T18:30:00.000Z');
  assert.equal(startOfDayIST(new Date('2026-10-10T10:00:00Z')).toISOString(), '2026-10-09T18:30:00.000Z');
  assert.equal(dayKeyIST(new Date('2026-10-10T20:00:00Z')), '2026-10-11');
});

test('isOpenNow', () => {
  const sat = (h, m) => new Date(Date.UTC(2026, 9, 10, h, m) - 5.5 * 3600e3); // Saturday 10 Oct 2026 IST
  const hours = [{ day: 6, open: '10:00', close: '22:00' }, { day: 0, closed: true }];
  assert.equal(isOpenNow([], sat(3, 0)), true); // no hours configured
  assert.equal(isOpenNow(hours, sat(9, 59)), false);
  assert.equal(isOpenNow(hours, sat(10, 0)), true);
  assert.equal(isOpenNow(hours, sat(21, 59)), true);
  assert.equal(isOpenNow(hours, sat(22, 0)), false);
  assert.equal(isOpenNow([{ day: 1, open: '10:00', close: '22:00' }], sat(12, 0)), false); // no entry for Saturday
  const late = [{ day: 6, open: '18:00', close: '02:00' }];
  assert.equal(isOpenNow(late, sat(23, 30)), true);
  assert.equal(isOpenNow(late, sat(1, 0)), true);
  assert.equal(isOpenNow(late, sat(12, 0)), false);
});

test('UPI link', () => {
  const uri = buildUpiUri({ vpa: 'cart@upi', payeeName: 'Smart Momos', amountPaise: 12550, note: 'Order SMC-1', reference: 'SMC1' });
  const p = new URL(uri.replace('upi://pay', 'https://x/pay')).searchParams;
  assert.equal(p.get('pa'), 'cart@upi');
  assert.equal(p.get('am'), '125.50');
  assert.equal(p.get('cu'), 'INR');
});

test('start of week (Monday) and month in IST', async () => {
  const { startOfWeekIST, startOfMonthIST } = await import('../../src/utils/time.js');
  // Saturday 10 Oct 2026, 10:00 IST -> week started Monday 5 Oct 00:00 IST
  assert.equal(startOfWeekIST(new Date('2026-10-10T04:30:00Z')).toISOString(), '2026-10-04T18:30:00.000Z');
  // Monday itself, 00:10 IST -> same day
  assert.equal(startOfWeekIST(new Date('2026-10-04T18:40:00Z')).toISOString(), '2026-10-04T18:30:00.000Z');
  // Sunday 11 Oct belongs to the week that began Monday 5 Oct
  assert.equal(startOfWeekIST(new Date('2026-10-11T04:00:00Z')).toISOString(), '2026-10-04T18:30:00.000Z');
  // 31 Oct 20:00 UTC is already 1 Nov in India -> November
  assert.equal(startOfMonthIST(new Date('2026-10-31T20:00:00Z')).toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(startOfMonthIST(new Date('2026-10-10T04:30:00Z')).toISOString(), '2026-09-30T18:30:00.000Z');
});
