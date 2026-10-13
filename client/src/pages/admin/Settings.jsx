import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorBox, Field, PageLoader, Spinner, Toggle } from '../../components/ui.jsx';
import { toPaise, toRupeeText } from '../../utils/format.js';

export default function Settings() {
  const toast = useToast();
  const { data, loading, error, reset } = useAsync(() => api.get('/admin/settings'), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ ...data.settings, packagingFee: toRupeeText(data.settings.packagingFeePaise) }); }, [data]);
  if (loading && !f) return <PageLoader />;
  if (error && !f) return <ErrorBox error={error} onRetry={reset} />;
  if (!f) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.put('/admin/settings', { businessName: f.businessName.trim(), tagline: f.tagline.trim(), taxEnabled: f.taxEnabled, taxPercent: Number(f.taxPercent) || 0, taxLabel: f.taxLabel.trim(), gstin: f.gstin.trim(), packagingFeePaise: toPaise(f.packagingFee || 0), cancellationWindowMinutes: Math.round(Number(f.cancellationWindowMinutes) || 0) });
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Business settings</h1>
      <section className="card space-y-3 p-5"><h2 className="font-sans text-lg font-bold">Brand</h2>
        <Field label="Business name"><input className="input" required value={f.businessName} onChange={(e) => set('businessName', e.target.value)} /></Field>
        <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field></section>
      <section className="card space-y-3 p-5"><h2 className="font-sans text-lg font-bold">Orders</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Packaging fee per order (₹)" hint="0 = none"><input className="input" type="number" min="0" step="0.5" value={f.packagingFee} onChange={(e) => set('packagingFee', e.target.value)} /></Field>
          <Field label="Customer can cancel within (minutes)" hint="Only while the order is still new and unpaid"><input className="input" type="number" min="0" max="60" value={f.cancellationWindowMinutes} onChange={(e) => set('cancellationWindowMinutes', e.target.value)} /></Field></div></section>
      <section className="card space-y-3 p-5"><h2 className="font-sans text-lg font-bold">Tax</h2>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Tax is OFF by default. Whether you must charge GST, and at what rate, depends on your registration and turnover. Ask your accountant before turning this on. When on, the percentage is added on top of the menu prices.</p>
        <label className="flex items-center gap-3 text-sm font-semibold"><Toggle checked={f.taxEnabled} onChange={(v) => set('taxEnabled', v)} label="Charge tax" />Charge tax on orders</label>
        {f.taxEnabled && <div className="grid gap-3 sm:grid-cols-3"><Field label="Name"><input className="input" value={f.taxLabel} onChange={(e) => set('taxLabel', e.target.value)} /></Field>
          <Field label="Percent"><input className="input" type="number" min="0" max="40" step="0.1" value={f.taxPercent} onChange={(e) => set('taxPercent', e.target.value)} /></Field>
          <Field label="GSTIN (optional)"><input className="input uppercase" value={f.gstin} onChange={(e) => set('gstin', e.target.value)} /></Field></div>}</section>
      <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? <Spinner /> : 'Save settings'}</button>
    </form>
  );
}
