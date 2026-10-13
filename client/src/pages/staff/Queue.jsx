import { useCallback, useEffect, useRef, useState } from 'react';
import { FiSearch, FiVolume2, FiVolumeX, FiWifi, FiWifiOff, FiCheckCircle } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useRealtime } from '../../hooks/useRealtime.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ConfirmModal, EmptyState, ErrorBox, Field, PageLoader, PaymentBadge, StatusBadge } from '../../components/ui.jsx';
import { METHOD_LABEL, SERVICE_LABEL, minutesAgo, rupees, timeOf } from '../../utils/format.js';

// A short two-tone beep made with the browser itself (no sound file needed).
function beep(ctx) {
  if (!ctx) return;
  [0, 0.18].forEach((t, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = i ? 1046 : 784; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.16);
    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.17);
  });
}

const NEXT = { Accepted: ['Preparing', 'Start preparing'], Preparing: ['Ready', 'Mark ready'] };

function OrderCard({ o, onAction }) {
  const waiting = minutesAgo(o.createdAt);
  const isNew = o.status === 'Placed';
  const manual = o.paymentMethod !== 'online';
  const unpaid = o.paymentStatus !== 'Paid';
  return (
    <article className={`card overflow-hidden ${isNew ? 'ring-2 ring-brand-500' : ''}`} aria-label={`Order ${o.orderNumber}`}>
      <div className={`flex items-center justify-between px-4 py-2 ${isNew ? 'bg-brand-500 text-white' : 'bg-ink/[.04]'}`}>
        <div><p className="font-mono text-sm font-bold">{o.orderNumber}</p><p className={`text-xs ${isNew ? 'text-white/80' : 'text-ink-mute'}`}>{timeOf(o.createdAt)} · {waiting} min ago · {o.customerName}</p></div>
      </div>
      <div className="space-y-3 p-4">
        <ul className="space-y-1">{o.items.map((i) => <li key={i.productId} className="flex gap-3 text-lg font-semibold"><span className="w-8 text-brand-600">{i.quantity}×</span><span>{i.name}</span></li>)}</ul>
        {o.instructions && <p className="rounded-lg bg-saffron/20 p-2 text-sm font-medium">📝 {o.instructions}</p>}
        <div className="flex flex-wrap items-center gap-2"><span className={`badge ${o.serviceType === 'dine_in' ? 'bg-saffron/40 text-ink' : 'bg-brand-100 text-brand-700'}`}>{SERVICE_LABEL[o.serviceType]}</span><StatusBadge status={o.status} /><span className="badge bg-ink/10">{METHOD_LABEL[o.paymentMethod]}</span><PaymentBadge status={o.paymentStatus} /><span className="ml-auto text-xl font-bold">{rupees(o.totalPaise)}</span></div>

        <div className="grid gap-2">
          {o.status === 'Placed' && (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-good btn-lg col-span-2" onClick={() => onAction('status', o, 'Accepted')}>Accept</button>
              <button className="btn btn-ghost btn-lg text-red-600" onClick={() => onAction('cancel', o)}>Reject</button>
            </div>
          )}
          {NEXT[o.status] && (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-primary btn-lg col-span-2" onClick={() => onAction('status', o, NEXT[o.status][0])}>{NEXT[o.status][1]}</button>
              {o.status === 'Accepted' && <button className="btn btn-ghost btn-lg text-red-600" onClick={() => onAction('cancel', o)}>Cancel</button>}
            </div>
          )}
          {['Placed', 'Accepted', 'Preparing', 'Ready'].includes(o.status) && manual && unpaid && o.paymentStatus === 'Pending' && (
            <button className="btn btn-dark" onClick={() => onAction('pay', o)}>{o.paymentMethod === 'cash' ? `Cash received · ${rupees(o.totalPaise)}` : `Verify UPI payment · ${rupees(o.totalPaise)}`}</button>
          )}
          {o.status === 'Ready' && (
            <button className="btn btn-good btn-lg" onClick={() => (unpaid ? onAction('pay', o) : onAction('complete', o))}>
              <FiCheckCircle /> {unpaid ? 'Confirm payment first' : 'Hand over & complete'}
            </button>
          )}
          {unpaid && o.paymentMethod === 'online' && o.status !== 'Cancelled' && <p className="text-xs text-ink-mute">Online payment confirms automatically once the customer pays.</p>}
        </div>
      </div>
    </article>
  );
}

export default function Queue() {
  const toast = useToast();
  const [scope, setScope] = useState('active');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, order }
  const [text, setText] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef(null);
  const scopeRef = useRef({ scope, q }); scopeRef.current = { scope, q };

  const load = useCallback(async () => {
    const { scope: s, q: term } = scopeRef.current;
    try { setOrders((await api.get('/staff/orders', { scope: s, q: term || undefined })).orders); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [scope, q, load]);

  const connected = useRealtime({
    'order:new': () => { load(); toast.info('🔔 New order!', 6000); navigator.vibrate?.([200, 100, 200]); if (sound) beep(audio.current); },
    'order:updated': load,
  }, load, 10000);

  const enableSound = () => { // browsers only allow sound after a tap
    if (!audio.current) audio.current = new (window.AudioContext || window.webkitAudioContext)();
    audio.current.resume?.(); setSound((v) => { if (!v) beep(audio.current); return !v; });
  };

  const patchLocal = (o) => setOrders((l) => l?.map((x) => (x.id === o.id ? o : x)));
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const { order } = await fn(); patchLocal(order); if (okMsg) toast.success(okMsg); setDialog(null); setText(''); setPin(''); load(); } catch (e) { toast.error(e.message); load(); setDialog(null); } finally { setBusy(false); }
  };
  const onAction = (kind, order, status) => {
    if (kind === 'status') return run(() => api.patch(`/staff/orders/${order.id}/status`, { status }), `${order.orderNumber}: ${status}`);
    setText(''); setPin(''); return setDialog({ kind, order });
  };

  const d = dialog;
  const active = (orders || []).filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled');
  const fresh = active.filter((o) => o.status === 'Placed');
  const rest = active.filter((o) => o.status !== 'Placed');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 rounded-xl bg-surface p-1 shadow-card" role="tablist">
          {[['active', 'Active'], ['completed', 'Done today']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={scope === k} onClick={() => { setScope(k); setQ(''); }} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${scope === k ? 'bg-ink text-white' : 'text-ink-soft'}`}>{label}{k === 'active' && active.length > 0 && !q ? ` (${active.length})` : ''}</button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={enableSound} aria-label={sound ? 'Turn sound off' : 'Turn new-order sound on'} aria-pressed={sound}>{sound ? <FiVolume2 /> : <FiVolumeX />}</button>
        <span className={`flex items-center gap-1 text-xs font-semibold ${connected ? 'text-leaf' : 'text-amber-600'}`} title={connected ? 'Live' : 'Reconnecting… refreshing every 10 seconds'}>{connected ? <FiWifi /> : <FiWifiOff />}</span>
      </div>
      <div className="relative"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input className="input pl-10" placeholder="Search order number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></div>

      {!orders && !error && <PageLoader />}
      {error && !orders && <ErrorBox error={error} onRetry={load} />}
      {orders && (q || scope === 'completed') && (orders.length === 0 ? <EmptyState title="No orders found" /> : <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} o={o} onAction={onAction} />)}</div>)}
      {orders && !q && scope === 'active' && (active.length === 0 ? <EmptyState title="No active orders" hint="New orders appear here automatically." /> : (
        <div className="space-y-3">
          {fresh.length > 0 && <h2 className="font-sans text-sm font-bold uppercase tracking-wide text-brand-600">New ({fresh.length})</h2>}
          {fresh.map((o) => <OrderCard key={o.id} o={o} onAction={onAction} />)}
          {rest.length > 0 && <h2 className="pt-2 font-sans text-sm font-bold uppercase tracking-wide text-ink-soft">In progress ({rest.length})</h2>}
          {rest.map((o) => <OrderCard key={o.id} o={o} onAction={onAction} />)}
        </div>
      ))}

      <ConfirmModal open={d?.kind === 'cancel'} danger title={`Cancel ${d?.order.orderNumber}?`} confirmLabel="Cancel order" busy={busy} onClose={() => setDialog(null)}
        onConfirm={() => run(() => api.patch(`/staff/orders/${d.order.id}/status`, { status: 'Cancelled', reason: text || 'Cancelled by cart' }), 'Order cancelled')}>
        <Field label="Reason"><select className="input" value={text} onChange={(e) => setText(e.target.value)}><option value="">Choose a reason</option>{['Item sold out', 'Cart is closing', 'Customer asked to cancel', 'Payment problem'].map((r) => <option key={r}>{r}</option>)}</select></Field>
      </ConfirmModal>

      <ConfirmModal open={d?.kind === 'pay'} title={d?.order.paymentMethod === 'cash' ? 'Cash received?' : 'Verify UPI payment'} confirmLabel={d?.order.paymentMethod === 'cash' ? 'Yes, I have the cash' : 'Yes, it arrived'} busy={busy} onClose={() => setDialog(null)}
        message={d && (d.order.paymentMethod === 'cash' ? `Only confirm after you are holding ${rupees(d.order.totalPaise)} in cash.` : `Open your UPI app and check that ${rupees(d.order.totalPaise)} has really been received. A screenshot is not proof.`)}
        onConfirm={() => run(() => api.post(`/staff/orders/${d.order.id}/confirm-payment`, { upiReference: text.trim() || undefined }), 'Payment confirmed')}>
        {d?.order.paymentMethod === 'upi' && <Field label="UPI reference (optional)"><input className="input" maxLength={40} value={text} onChange={(e) => setText(e.target.value)} placeholder="Last digits of transaction id" /></Field>}
      </ConfirmModal>

      <ConfirmModal open={d?.kind === 'complete'} title={`Hand over ${d?.order.orderNumber}`} message="Ask the customer for their 4-digit PIN and type it here." confirmLabel="Complete order" busy={busy} onClose={() => setDialog(null)}
        onConfirm={() => (pin.length === 4 ? run(() => api.patch(`/staff/orders/${d.order.id}/status`, { status: 'Completed', pin }), 'Order completed') : toast.error('Enter the 4-digit PIN'))}>
        <input className="input text-center font-mono text-3xl tracking-[.5em]" autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN" aria-label="Customer 4-digit PIN" />
      </ConfirmModal>
    </div>
  );
}
