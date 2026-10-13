import { useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EmptyState, ErrorBox, Field, Modal, PageLoader, Spinner, Toggle } from '../../components/ui.jsx';
import { rupees, toPaise, toRupeeText } from '../../utils/format.js';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const blank = { code: '', title: '', description: '', type: 'percent', value: '10', minOrder: '0', maxDiscount: '0', startsAt: '', expiresAt: '', usageLimit: '0', perUserLimit: '1', showOnHome: true, isActive: true };
const status = (o) => (!o.isActive ? ['Off', 'bg-ink/10 text-ink-soft'] : o.expiresAt && new Date(o.expiresAt) < new Date() ? ['Expired', 'bg-red-100 text-red-700'] : o.usageLimit > 0 && o.usedCount >= o.usageLimit ? ['Used up', 'bg-amber-100 text-amber-800'] : ['Live', 'bg-green-100 text-green-800']);

function OfferForm({ offer, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(offer ? { ...offer, value: String(offer.type === 'flat' ? offer.value / 100 : offer.value), minOrder: toRupeeText(offer.minOrderPaise), maxDiscount: toRupeeText(offer.maxDiscountPaise), startsAt: day(offer.startsAt), expiresAt: day(offer.expiresAt), usageLimit: String(offer.usageLimit), perUserLimit: String(offer.perUserLimit), description: offer.description || '' } : blank);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = {
      code: f.code, title: f.title.trim(), description: f.description.trim(), type: f.type,
      value: f.type === 'flat' ? toPaise(f.value) : Math.round(Number(f.value)), minOrderPaise: toPaise(f.minOrder || 0), maxDiscountPaise: f.type === 'percent' ? toPaise(f.maxDiscount || 0) : 0,
      startsAt: f.startsAt || undefined, expiresAt: f.expiresAt ? `${f.expiresAt}T23:59:59+05:30` : undefined,
      usageLimit: Math.round(Number(f.usageLimit) || 0), perUserLimit: Math.round(Number(f.perUserLimit) || 0), eligibleProductIds: offer?.eligibleProductIds || [], showOnHome: f.showOnHome, isActive: f.isActive,
    };
    try { if (offer) await api.put(`/admin/offers/${offer.id}`, body); else await api.post('/admin/offers', body); toast.success('Offer saved'); onSaved(); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={offer ? `Edit ${offer.code}` : 'New offer'}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><Field label="Code" hint="Letters/numbers"><input className="input font-mono uppercase" required disabled={Boolean(offer)} maxLength={20} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
          <Field label="Title"><input className="input" required maxLength={80} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
        <Field label="Description (shown to customers)"><input className="input" maxLength={200} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select></Field>
          <Field label={f.type === 'percent' ? 'Percent (1-100)' : 'Amount (₹)'}><input className="input" type="number" required min="1" max={f.type === 'percent' ? 100 : undefined} value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>
          <Field label="Minimum order (₹)"><input className="input" type="number" min="0" value={f.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></Field>
          {f.type === 'percent' && <Field label="Max discount (₹)" hint="0 = no limit"><input className="input" type="number" min="0" value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} /></Field>}
          <Field label="Starts"><input className="input" type="date" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
          <Field label="Expires (end of day)"><input className="input" type="date" value={f.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} /></Field>
          <Field label="Total uses" hint="0 = unlimited"><input className="input" type="number" min="0" value={f.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} /></Field>
          <Field label="Uses per customer" hint="0 = unlimited"><input className="input" type="number" min="0" value={f.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} /></Field>
        </div>
        <div className="flex gap-6 text-sm"><label className="flex items-center gap-2"><Toggle checked={f.showOnHome} onChange={(v) => set('showOnHome', v)} label="Show on home" />Show on home page</label><label className="flex items-center gap-2"><Toggle checked={f.isActive} onChange={(v) => set('isActive', v)} label="Active" />Active</label></div>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Save offer'}</button>
      </form>
    </Modal>
  );
}

export default function Offers() {
  const toast = useToast();
  const { data, loading, error, reload, reset } = useAsync(() => api.get('/admin/offers'), []);
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <PageLoader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reset} />;
  const run = async (fn) => { try { await fn(); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Offers & coupons</h1><button className="btn btn-primary" onClick={() => setEdit('new')}><FiPlus /> New offer</button></div>
      {data.offers.length === 0 ? <EmptyState title="No offers yet" hint="Create a discount code for your customers." /> : (
        <div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Used</th><th>Status</th><th>On</th><th /></tr></thead>
          <tbody>{data.offers.map((o) => { const [label, cls] = status(o); return (
            <tr key={o.id}><td><p className="font-mono font-bold">{o.code}</p><p className="text-xs text-ink-mute">{o.title}</p></td>
              <td className="font-semibold">{o.type === 'percent' ? `${o.value}%` : rupees(o.value)}{o.type === 'percent' && o.maxDiscountPaise > 0 && <span className="block text-xs font-normal text-ink-mute">max {rupees(o.maxDiscountPaise)}</span>}</td>
              <td className="text-xs text-ink-soft">{o.minOrderPaise > 0 ? `Min ${rupees(o.minOrderPaise)}` : 'No minimum'}<br />{o.expiresAt ? `Until ${day(o.expiresAt)}` : 'No expiry'}<br />{o.perUserLimit ? `${o.perUserLimit}/customer` : 'Unlimited per customer'}</td>
              <td>{o.usedCount}{o.usageLimit > 0 ? ` / ${o.usageLimit}` : ''}</td><td><span className={`badge ${cls}`}>{label}</span></td>
              <td><Toggle checked={o.isActive} label={`${o.code} active`} onChange={(v) => run(() => api.patch(`/admin/offers/${o.id}`, { isActive: v }))} /></td>
              <td className="whitespace-nowrap text-right"><button className="p-2" aria-label={`Edit ${o.code}`} onClick={() => setEdit(o)}><FiEdit2 /></button><button className="p-2 text-red-600" aria-label={`Delete ${o.code}`} onClick={() => window.confirm(`Delete offer ${o.code}?`) && run(() => api.del(`/admin/offers/${o.id}`))}><FiTrash2 /></button></td></tr>); })}</tbody></table></div>
      )}
      {edit && <OfferForm offer={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
