import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiCopy, FiX } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useRealtime } from '../../hooks/useRealtime.js';
import { ConfirmModal, ErrorBox, PageLoader, PaymentBadge, Spinner, StatusBadge } from '../../components/ui.jsx';
import { dateTime, loadScript, METHOD_LABEL, SERVICE_LABEL, rupees } from '../../utils/format.js';

const STEPS = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Completed'];
const STEP_HINT = { Placed: 'Waiting for the cart to accept', Accepted: 'Accepted by the cart', Preparing: 'Being cooked fresh', Ready: 'Ready. Show your code to collect!', Completed: 'Enjoy your momos!' };

function Tracker({ status }) {
  if (status === 'Cancelled') return <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 font-semibold text-red-700"><FiX /> This order was cancelled</div>;
  const at = STEPS.indexOf(status);
  return (
    <ol className="space-y-3" aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-3" aria-current={i === at ? 'step' : undefined}>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i < at ? 'bg-leaf text-white' : i === at ? 'bg-brand-500 text-white ring-4 ring-brand-200' : 'bg-ink/10 text-ink-mute'}`}>{i < at ? <FiCheck /> : i + 1}</span>
          <span className={i === at ? 'font-bold' : i < at ? 'text-ink-soft' : 'text-ink-mute'}>{s}{i === at && <span className="block text-xs font-normal text-ink-soft">{STEP_HINT[s]}</span>}</span>
        </li>
      ))}
    </ol>
  );
}

function UpiBox({ order }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/orders/${order.id}/upi`).then(setInfo).catch((e) => setErr(e.message)); }, [order.id, order.totalPaise]);
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!info) return <Spinner className="text-brand-500" />;
  return (
    <div className="space-y-3 text-center">
      <img src={info.qrDataUrl} alt={`UPI QR code to pay ${rupees(info.amountPaise)}`} className="mx-auto h-56 w-56 rounded-xl border border-ink/10" />
      <p className="text-sm text-ink-soft">Scan with any UPI app to pay <b>{rupees(info.amountPaise)}</b> to <b>{info.payeeName}</b><br /><span className="font-mono text-xs">{info.vpa}</span></p>
      <a href={info.uri} className="btn btn-primary w-full sm:hidden">Open my UPI app</a>
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Your payment shows as <b>Paid</b> only after the cart staff verify it. Keep your payment screen ready.</p>
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const loc = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoPay = useRef(sp.get('pay') === '1');

  const load = useCallback(async () => {
    try { setOrder((await api.get(`/orders/${id}`)).order); setError(null); } catch (e) { setError(e); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const done = order && ['Completed', 'Cancelled'].includes(order.status) && order.paymentStatus !== 'Pending';
  useRealtime({ 'order:updated': (o) => o.id === id && setOrder(o) }, load, done ? 0 : 10000);

  const payOnline = useCallback(async () => {
    setBusy(true);
    try {
      const [{ keyId, gatewayOrderId, amountPaise, currency }] = await Promise.all([api.post('/payments/online/create', { orderId: id }), loadScript('https://checkout.razorpay.com/v1/checkout.js')]);
      const rzp = new window.Razorpay({
        key: keyId, order_id: gatewayOrderId, amount: amountPaise, currency, name: 'Smart Momos', description: `Order ${order?.orderNumber || ''}`,
        prefill: { email: user?.email, name: user?.name },
        theme: { color: '#ef5a17' },
        // The browser reports success, but the SERVER checks the signature before marking anything paid.
        handler: async (r) => {
          try { setOrder((await api.post('/payments/online/verify', { orderId: id, ...r })).order); toast.success('Payment confirmed'); } catch (e) { toast.error(e.message); load(); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', () => { toast.error('Payment failed. You can try again.'); load(); });
      rzp.open();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [id, order?.orderNumber, user, toast, load]);

  useEffect(() => { if (autoPay.current && order?.paymentMethod === 'online' && order.paymentStatus === 'Pending') { autoPay.current = false; payOnline(); } }, [order, payOnline]);

  const cancel = async () => {
    setBusy(true);
    try { setOrder((await api.post(`/orders/${id}/cancel`)).order); toast.success('Order cancelled'); setConfirmCancel(false); } catch (e) { toast.error(e.message); load(); setConfirmCancel(false); } finally { setBusy(false); }
  };

  if (error && !order) return <ErrorBox error={error} onRetry={load} />;
  if (!order) return <PageLoader />;
  const needsPay = order.paymentStatus === 'Pending' || order.paymentStatus === 'Failed';
  const active = !['Completed', 'Cancelled'].includes(order.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {loc.state?.justPlaced && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl bg-leaf p-5 text-center text-white">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl"><FiCheck /></div>
          <h1 className="text-2xl font-bold">Order placed!</h1><p className="text-sm text-white/90">Keep this screen open. It updates live.</p>
        </motion.div>
      )}
      <div className="card space-y-3 p-5 text-center">
        <div className="flex items-center justify-center gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /><span className="badge bg-ink/10">{SERVICE_LABEL[order.serviceType]}</span></div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Order number</p>
        <p className="font-mono text-lg font-bold">{order.orderNumber}</p>
        <div className="rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your pickup PIN</p>
          {user?.pin ? (
            <button className="mx-auto flex items-center gap-3 font-mono text-5xl font-bold tracking-[.3em] text-brand-700" onClick={() => { navigator.clipboard?.writeText(user.pin); toast.info('PIN copied'); }} aria-label={`Pickup PIN ${user.pin.split('').join(' ')}. Tap to copy`}>
              {user.pin}<FiCopy className="h-4 w-4 opacity-60" /></button>
          ) : <p className="text-sm text-ink-soft">Open your Account page to see your PIN.</p>}
          <p className="text-xs text-ink-soft">Tell this PIN to the staff when you collect. It is the same for every order, like a ride OTP.</p>
        </div>
      </div>

      <section className="card p-5"><h2 className="mb-3 text-lg font-bold">Status</h2><Tracker status={order.status} />
        {order.cancelledReason && order.status === 'Cancelled' && <p className="mt-3 text-sm text-ink-soft">Reason: {order.cancelledReason}</p>}</section>

      {order.status !== 'Cancelled' && (
        <section className="card space-y-3 p-5"><h2 className="text-lg font-bold">Payment · {METHOD_LABEL[order.paymentMethod]}</h2>
          {order.paymentStatus === 'Paid' && <p className="text-sm text-leaf">Payment received. Thank you!</p>}
          {order.paymentStatus === 'Refunded' && <p className="text-sm text-purple-700">This payment was refunded.</p>}
          {order.paymentMethod === 'cash' && needsPay && <p className="text-sm text-ink-soft">Pay <b>{rupees(order.totalPaise)}</b> in cash at the cart. Staff will confirm it.</p>}
          {order.paymentMethod === 'upi' && needsPay && <UpiBox order={order} />}
          {order.paymentMethod === 'online' && needsPay && (
            <div className="space-y-2">
              {order.paymentStatus === 'Failed' && <p className="text-sm text-red-600">Your last payment attempt failed.</p>}
              <button className="btn btn-primary btn-lg w-full" onClick={payOnline} disabled={busy}>{busy ? <Spinner /> : `Pay ${rupees(order.totalPaise)} now`}</button>
              <p className="text-xs text-ink-mute">We mark this order paid only after the payment is verified by our server.</p>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-2 p-5"><h2 className="text-lg font-bold">Bill</h2>
        {order.items.map((i) => <div key={i.productId} className="flex justify-between text-sm"><span>{i.quantity} × {i.name}</span><span>{rupees(i.lineTotalPaise)}</span></div>)}
        <hr className="border-ink/10" />
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{rupees(order.subtotalPaise)}</span></div>
        {order.discountPaise > 0 && <div className="flex justify-between text-sm text-leaf"><span>Offer {order.offerCode}</span><span>− {rupees(order.discountPaise)}</span></div>}
        {order.feePaise > 0 && <div className="flex justify-between text-sm"><span>Packaging</span><span>{rupees(order.feePaise)}</span></div>}
        {order.taxPaise > 0 && <div className="flex justify-between text-sm"><span>{order.taxLabel}</span><span>{rupees(order.taxPaise)}</span></div>}
        <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold"><span>Total</span><span>{rupees(order.totalPaise)}</span></div>
        {order.instructions && <p className="text-sm text-ink-soft">Note: {order.instructions}</p>}
        <p className="text-xs text-ink-mute">{order.outletName} · {dateTime(order.createdAt)}</p>
      </section>

      {active && order.permissions?.canCancel && <button className="btn btn-ghost w-full text-red-600" onClick={() => setConfirmCancel(true)}>Cancel order</button>}
      {active && !order.permissions?.canCancel && order.status === 'Placed' && <p className="text-center text-xs text-ink-mute">Cancellation window has passed. Please speak to the cart staff.</p>}
      <Link to="/menu" className="btn btn-ghost w-full">Order more</Link>
      <ConfirmModal open={confirmCancel} danger title="Cancel this order?" message="This cannot be undone." confirmLabel="Yes, cancel" busy={busy} onConfirm={cancel} onClose={() => setConfirmCancel(false)} />
    </div>
  );
}
