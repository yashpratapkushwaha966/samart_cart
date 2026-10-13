import { customerCancelBlocker } from './orderStateMachine.js';

/**
 * One function decides what each audience may see.
 *  - customer: own order only, with a server-computed "canCancel" flag
 *  - staff:    operational data + first name only (no email / phone)
 *  - admin:    everything, including customer contact details and who changed what
 */
export function serializeOrder(order, viewer, { settings } = {}) {
  const o = order.toObject ? order.toObject() : order;
  const outletObj = o.outlet?.name !== undefined ? o.outlet : null; // populated documents only
  const customerObj = o.customer?.email !== undefined ? o.customer : null;
  const out = {
    id: String(o._id), orderNumber: o.orderNumber,
    status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, serviceType: o.serviceType || 'takeaway',
    items: (o.items || []).map((i) => ({
      productId: String(i.product), name: i.name, pricePaise: i.pricePaise, quantity: i.quantity, lineTotalPaise: i.lineTotalPaise,
    })),
    instructions: o.instructions || '',
    subtotalPaise: o.subtotalPaise, discountPaise: o.discountPaise, offerCode: o.offerCode || null,
    feePaise: o.feePaise, taxPaise: o.taxPaise, taxLabel: o.taxLabel || null, totalPaise: o.totalPaise,
    outletId: String(o.outlet?._id ?? o.outlet), outletName: outletObj?.name,
    customerName: o.customerName, cancelledReason: o.cancelledReason || null,
    createdAt: o.createdAt, updatedAt: o.updatedAt,
    statusHistory: (o.statusHistory || []).map((h) => ({ status: h.status, at: h.at })),
  };
  if (viewer === 'customer') {
    out.permissions = { canCancel: !customerCancelBlocker(o, settings) };
  }
  if (viewer === 'admin') {
    out.customer = customerObj
      ? { id: String(customerObj._id), name: customerObj.name, email: customerObj.email, phone: customerObj.phone }
      : { id: String(o.customer) };
    out.statusHistory = (o.statusHistory || []).map((h) => ({ status: h.status, at: h.at, role: h.role, note: h.note }));
  }
  return out;
}
