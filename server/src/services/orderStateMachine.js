import { AppError, conflict, forbidden } from '../utils/AppError.js';

export const ORDER_STATUS = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
export const PAYMENT_STATUS = ['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded'];
export const ACTIVE_ORDER_STATUSES = ['Placed', 'Accepted', 'Preparing', 'Ready'];

// from -> { to: [roles allowed to make that move] }
const TRANSITIONS = {
  Placed: { Accepted: ['staff', 'admin'], Cancelled: ['customer', 'staff', 'admin'] },
  Accepted: { Preparing: ['staff', 'admin'], Cancelled: ['staff', 'admin'] },
  Preparing: { Ready: ['staff', 'admin'] },
  Ready: { Completed: ['staff', 'admin'] },
  Completed: {},
  Cancelled: {},
};

export function canTransition(from, to, role) {
  return Boolean(TRANSITIONS[from]?.[to]?.includes(role));
}

export function assertTransition(from, to, role) {
  if (!TRANSITIONS[from]) throw new AppError(400, `Unknown order status "${from}"`, 'BAD_STATUS');
  if (!TRANSITIONS[from][to]) {
    throw conflict(`An order cannot move from ${from} to ${to}`, 'INVALID_TRANSITION');
  }
  if (!TRANSITIONS[from][to].includes(role)) {
    throw forbidden(`Your role cannot move an order from ${from} to ${to}`, 'ROLE_NOT_ALLOWED');
  }
}

/** Customer cancellation rule: only while still "Placed", unpaid, and inside the cancellation window. */
export function customerCancelBlocker(order, settings, now = new Date()) {
  if (order.status !== 'Placed') return 'The kitchen has already accepted this order.';
  if (order.paymentStatus === 'Paid') return 'A paid order cannot be cancelled online. Please speak to the cart staff.';
  const windowMin = settings?.cancellationWindowMinutes ?? 5;
  const ageMin = (now.getTime() - new Date(order.createdAt).getTime()) / 60000;
  if (ageMin > windowMin) return `Orders can only be cancelled within ${windowMin} minutes of placing them.`;
  return null;
}

export function assertCustomerCanCancel(order, settings, now) {
  const reason = customerCancelBlocker(order, settings, now);
  if (reason) throw conflict(reason, 'CANCEL_NOT_ALLOWED');
}

// Payment status moves. Cancelled -> Paid exists only because a gateway may capture money late;
// the payment service raises an admin alert so the owner can refund it.
const PAYMENT_TRANSITIONS = {
  Pending: ['Paid', 'Failed', 'Cancelled'],
  Failed: ['Pending', 'Paid', 'Cancelled'],
  Paid: ['Refunded'],
  Cancelled: ['Paid'],
  Refunded: [],
};
export const canPaymentTransition = (from, to) => Boolean(PAYMENT_TRANSITIONS[from]?.includes(to));
