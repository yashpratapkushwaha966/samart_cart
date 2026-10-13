import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition, assertTransition, customerCancelBlocker, canPaymentTransition,
} from '../../src/services/orderStateMachine.js';

test('happy path is allowed for staff in order', () => {
  assert.ok(canTransition('Placed', 'Accepted', 'staff'));
  assert.ok(canTransition('Accepted', 'Preparing', 'staff'));
  assert.ok(canTransition('Preparing', 'Ready', 'staff'));
  assert.ok(canTransition('Ready', 'Completed', 'staff'));
});

test('staff cannot skip steps (e.g. complete an order that was never accepted)', () => {
  assert.throws(() => assertTransition('Placed', 'Completed', 'staff'), { code: 'INVALID_TRANSITION' });
  assert.throws(() => assertTransition('Placed', 'Ready', 'staff'), { code: 'INVALID_TRANSITION' });
  assert.throws(() => assertTransition('Accepted', 'Completed', 'staff'), { code: 'INVALID_TRANSITION' });
  assert.throws(() => assertTransition('Preparing', 'Completed', 'admin'), { code: 'INVALID_TRANSITION' });
});

test('terminal states cannot move anywhere', () => {
  for (const to of ['Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled']) {
    assert.equal(canTransition('Completed', to, 'admin'), false);
    assert.equal(canTransition('Cancelled', to, 'admin'), false);
  }
});

test('customers may only cancel, and only from Placed', () => {
  assert.ok(canTransition('Placed', 'Cancelled', 'customer'));
  assert.equal(canTransition('Accepted', 'Cancelled', 'customer'), false);
  assert.equal(canTransition('Placed', 'Accepted', 'customer'), false);
  assert.throws(() => assertTransition('Placed', 'Accepted', 'customer'), { code: 'ROLE_NOT_ALLOWED' });
});

test('customer cancellation rules', () => {
  const now = new Date('2026-10-10T10:10:00Z');
  const fresh = { status: 'Placed', paymentStatus: 'Pending', createdAt: new Date('2026-10-10T10:08:00Z') };
  assert.equal(customerCancelBlocker(fresh, { cancellationWindowMinutes: 5 }, now), null);
  assert.match(customerCancelBlocker({ ...fresh, createdAt: new Date('2026-10-10T10:00:00Z') }, { cancellationWindowMinutes: 5 }, now), /within 5 minutes/);
  assert.match(customerCancelBlocker({ ...fresh, status: 'Accepted' }, {}, now), /already accepted/);
  assert.match(customerCancelBlocker({ ...fresh, paymentStatus: 'Paid' }, {}, now), /paid order/i);
});

test('payment status transitions', () => {
  assert.ok(canPaymentTransition('Pending', 'Paid'));
  assert.ok(canPaymentTransition('Paid', 'Refunded'));
  assert.equal(canPaymentTransition('Refunded', 'Paid'), false);
  assert.equal(canPaymentTransition('Paid', 'Pending'), false);
  assert.equal(canPaymentTransition('Paid', 'Cancelled'), false);
});
