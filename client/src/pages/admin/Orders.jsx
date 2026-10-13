import { useState } from 'react';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useRealtime } from '../../hooks/useRealtime.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorBox, Modal, PageLoader, PaymentBadge, Spinner, StatusBadge } from '../../components/ui.jsx';
import { dateTime, METHOD_LABEL, SERVICE_LABEL, rupees } from '../../utils/format.js';

const NEXT = { Placed: ['Accepted'], Accepted: ['Preparing'], Preparing: ['Ready'], Ready: ['Completed'] };

function Detail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/orders/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast.success(msg); await reload(); onChanged(); } catch (e) { toast.error(e.message); reload(); } finally { setBusy(false); } };
  const o = data?.order;
  return (
    <Modal open onClose={onClose} title={o ? `Order ${o.orderNumber}` : 'Order'} wide>
      {loading && !o && <PageLoader />}{error && !o && <ErrorBox error={error} onRetry={reload} />}
      {o && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /><span className="badge bg-ink/10">{METHOD_LABEL[o.paymentMethod]}</span><span className="badge bg-saffron/40">{SERVICE_LABEL[o.serviceType]}</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-ink/[.04] p-3"><p className="label">Customer</p><p className="font-semibold">{o.customer.name || '—'}</p><p>{o.customer.email}</p><p>{o.customer.phone || ''}</p><p className="mt-1 text-xs text-ink-mute">{o.outletName} · {dateTime(o.createdAt)}</p></div>
            <div className="rounded-xl bg-ink/[.04] p-3"><p className="label">Items</p>{o.items.map((i) => <div key={i.productId} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{rupees(i.lineTotalPaise)}</span></div>)}
              {o.discountPaise > 0 && <div className="flex justify-between text-leaf"><span>Offer {o.offerCode}</span><span>− {rupees(o.discountPaise)}</span></div>}
              {o.feePaise > 0 && <div className="flex justify-between"><span>Packaging</span><span>{rupees(o.feePaise)}</span></div>}
              {o.taxPaise > 0 && <div className="flex justify-between"><span>{o.taxLabel}</span><span>{rupees(o.taxPaise)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-ink/10 pt-1 text-base font-bold"><span>Total</span><span>{rupees(o.totalPaise)}</span></div>{o.instructions && <p className="mt-1 text-ink-soft">Note: {o.instructions}</p>}</div>
          </div>
          {o.payment && <div className="rounded-xl bg-ink/[.04] p-3"><p className="label">Payment record</p>
            <p>Status: <b>{o.payment.status}</b>{o.payment.confirmedAt && <> · confirmed {dateTime(o.payment.confirmedAt)} by {o.payment.confirmedByRole}</>}</p>
            {o.payment.upiReference && <p>UPI reference: {o.payment.upiReference}</p>}{o.payment.gatewayPaymentId && <p className="break-all">Gateway payment: {o.payment.gatewayPaymentId}</p>}
            {o.payment.duplicatePaymentIds.length > 0 && <p className="mt-1 rounded-lg bg-red-50 p-2 font-semibold text-red-700">⚠ Extra payment(s) received: {o.payment.duplicatePaymentIds.join(', ')}. Refund from the Razorpay dashboard.</p>}
            {o.status === 'Cancelled' && o.payment.status === 'Paid' && <p className="mt-1 rounded-lg bg-amber-50 p-2 font-semibold text-amber-800">This cancelled order was paid. Refund the customer, then record it below.</p>}
            {o.payment.refundNote && <p>Refund note: {o.payment.refundNote}</p>}</div>}
          <div><p className="label">History</p><ul className="space-y-0.5 text-xs text-ink-soft">{o.statusHistory.map((h, i) => <li key={i}>{dateTime(h.at)} · {h.status} <span className="text-ink-mute">({h.role}{h.note ? `: ${h.note}` : ''})</span></li>)}</ul></div>
          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            {(NEXT[o.status] || []).map((s) => <button key={s} className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => api.patch(`/admin/orders/${o.id}/status`, { status: s }), `Marked ${s}`)}>Mark {s}</button>)}
            {['Placed', 'Accepted'].includes(o.status) && <button className="btn btn-ghost btn-sm text-red-600" disabled={busy} onClick={() => window.confirm('Cancel this order?') && act(() => api.patch(`/admin/orders/${o.id}/status`, { status: 'Cancelled', reason: 'Cancelled by owner' }), 'Order cancelled')}>Cancel order</button>}
            {o.paymentMethod !== 'online' && o.paymentStatus === 'Pending' && o.status !== 'Cancelled' && <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => window.confirm('Confirm that the money was received?') && act(() => api.post(`/admin/orders/${o.id}/confirm-payment`, {}), 'Payment confirmed')}>Confirm payment received</button>}
            {o.paymentStatus === 'Paid' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { const note = window.prompt('Record that you have refunded this customer. Note (optional):'); if (note !== null) act(() => api.post(`/admin/orders/${o.id}/refund`, { note: note || undefined }), 'Marked refunded'); }}>Record refund</button>}
            {busy && <Spinner className="text-brand-500" />}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [f, setF] = useState({ status: '', paymentStatus: '', method: '', from: '', to: '', q: '', page: 1 });
  const [open, setOpen] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, page: k === 'page' ? v : 1 }));
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/orders', Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))), [f]);
  useRealtime({ 'order:new': reload, 'order:updated': reload }, reload, 0);

  const sel = (k, opts, label) => <select className="input w-auto" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-label={label}><option value="">{label}</option>{opts.map((o) => <option key={o} value={o}>{METHOD_LABEL[o] || o}</option>)}</select>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Orders</h1>
      <div className="flex flex-wrap gap-2">
        <input className="input w-48" placeholder="Order number" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search orders" />
        {sel('status', ['Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled'], 'Any status')}
        {sel('paymentStatus', ['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded'], 'Any payment')}
        {sel('method', ['cash', 'upi', 'online'], 'Any method')}
        <input className="input w-auto" type="date" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
        <input className="input w-auto" type="date" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
      </div>
      {loading && !data ? <PageLoader /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Method</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>{data.orders.map((o) => (<tr key={o.id} className="cursor-pointer hover:bg-brand-50" onClick={() => setOpen(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}>
              <td className="font-mono text-xs font-bold">{o.orderNumber}</td><td>{dateTime(o.createdAt)}</td><td>{o.customer.name || o.customer.email}</td><td className="font-semibold">{rupees(o.totalPaise)}</td><td>{METHOD_LABEL[o.paymentMethod]}</td><td><StatusBadge status={o.status} /></td><td><PaymentBadge status={o.paymentStatus} /></td></tr>))}
              {data.orders.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-ink-mute">No orders match these filters</td></tr>}</tbody></table></div>
          <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">{data.total} order(s)</span>
            <div className="flex items-center gap-2"><button className="btn btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => set('page', data.page - 1)}>Previous</button><span>Page {data.page} / {data.pages}</span><button className="btn btn-ghost btn-sm" disabled={data.page >= data.pages} onClick={() => set('page', data.page + 1)}>Next</button></div></div>
        </>
      )}
      {open && <Detail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
