import { useState } from 'react';
import { FiDownload, FiEdit2, FiPlus, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorBox, Field, Modal, PageLoader, Spinner, Toggle } from '../../components/ui.jsx';
import { dateTime } from '../../utils/format.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fullHours = (h = []) => DAYS.map((_, day) => h.find((x) => x.day === day) || { day, closed: false, open: '10:00', close: '22:00' });

function QrModal({ outlet, onClose }) {
  const { data, loading, error } = useAsync(() => api.get(`/admin/outlets/${outlet.id}/qr`), []);
  const print = () => {
    const w = window.open('', '_blank', 'width=600,height=800'); if (!w) return;
    w.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:30px"><h1 style="font-size:34px">🥟 ${outlet.name}</h1><h2>Scan to order</h2><img src="${data.png}" style="width:420px"/><p style="font-size:18px">Open your phone camera and point it at the code.<br/>No app needed.</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  return (
    <Modal open onClose={onClose} title={`QR code · ${outlet.name}`}>
      {loading && <PageLoader />}{error && <ErrorBox error={error} />}
      {data && (<div className="space-y-3 text-center">
        <img src={data.png} alt="QR code that opens the menu" className="mx-auto w-64 rounded-xl border border-ink/10" />
        <p className="break-all rounded-lg bg-ink/[.04] p-2 font-mono text-xs">{data.url}</p>
        {!/^https:|localhost/.test(data.url) && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This link is not https. Set CLIENT_URL on the server to your real website address before printing.</p>}
        {/localhost|127\.0\.0\.1/.test(data.url) && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This QR points to localhost, so it only works on this computer. Deploy the site and set CLIENT_URL, then print the new QR.</p>}
        <div className="flex gap-2"><a className="btn btn-ghost flex-1" href={data.png} download={`${outlet.slug}-qr.png`}><FiDownload /> PNG</a>
          <a className="btn btn-ghost flex-1" href={`data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`} download={`${outlet.slug}-qr.svg`}><FiDownload /> SVG</a>
          <button className="btn btn-primary flex-1" onClick={print}><FiPrinter /> Print</button></div></div>)}
    </Modal>
  );
}

function OutletForm({ outlet, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(outlet ? { ...outlet, vpa: outlet.upi.vpa, payee: outlet.upi.payeeName, hours: fullHours(outlet.openingHours), useHours: outlet.openingHours.length > 0 } : { name: '', code: '', slug: '', address: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setHour = (i, k, v) => setF((x) => ({ ...x, hours: x.hours.map((h, j) => (j === i ? { ...h, [k]: v } : h)) }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (outlet) await api.patch(`/admin/outlets/${outlet.id}`, { name: f.name, address: f.address, isAcceptingOrders: f.isAcceptingOrders, upi: { vpa: f.vpa || '', payeeName: f.payee || '' }, openingHours: f.useHours ? f.hours.map((h) => (h.closed ? { day: h.day, closed: true } : h)) : [] });
      else await api.post('/admin/outlets', { name: f.name, code: f.code, slug: f.slug, address: f.address });
      toast.success('Saved'); onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={outlet ? `Edit ${outlet.name}` : 'Add a cart'} wide>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Cart name"><input className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Address / landmark"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
          {!outlet && <><Field label="Short code" hint="2-6 letters, used in order numbers"><input className="input uppercase" required maxLength={6} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
            <Field label="Link name" hint="e.g. new-market-cart"><input className="input" required value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></Field></>}
          {outlet && <><Field label="Your UPI id" hint="Customers pay to this. Leave empty to turn UPI off."><input className="input" placeholder="name@bank" value={f.vpa} onChange={(e) => set('vpa', e.target.value.trim())} /></Field>
            <Field label="Name shown on UPI"><input className="input" value={f.payee} onChange={(e) => set('payee', e.target.value)} /></Field></>}
        </div>
        {outlet && (<>
          <label className="flex items-center gap-3 rounded-xl bg-ink/[.04] p-3 text-sm font-semibold"><Toggle checked={f.isAcceptingOrders} onChange={(v) => set('isAcceptingOrders', v)} label="Accepting orders" />Accepting orders now <span className="font-normal text-ink-mute">(switch off to pause)</span></label>
          <label className="flex items-center gap-3 text-sm font-semibold"><Toggle checked={f.useHours} onChange={(v) => set('useHours', v)} label="Use opening hours" />Only accept orders during opening hours (India time)</label>
          {f.useHours && <div className="space-y-1.5">{f.hours.map((h, i) => (
            <div key={h.day} className="flex items-center gap-2 text-sm"><span className="w-24 font-semibold">{DAYS[h.day]}</span><label className="flex items-center gap-1"><input type="checkbox" checked={!h.closed} onChange={(e) => setHour(i, 'closed', !e.target.checked)} />Open</label>
              {!h.closed && <><input type="time" className="input w-auto py-1.5" value={h.open} onChange={(e) => setHour(i, 'open', e.target.value)} aria-label={`${DAYS[h.day]} opens`} />to<input type="time" className="input w-auto py-1.5" value={h.close} onChange={(e) => setHour(i, 'close', e.target.value)} aria-label={`${DAYS[h.day]} closes`} /></>}</div>))}</div>}
        </>)}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Save cart'}</button>
      </form>
    </Modal>
  );
}

function StaffForm({ person, outlets, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(person ? { ...person, password: '' } : { name: '', email: '', phone: '', password: '', outletIds: outlets[0] ? [outlets[0].id] : [] });
  const [busy, setBusy] = useState(false);
  const toggleOutlet = (id) => setF((x) => ({ ...x, outletIds: x.outletIds.includes(id) ? x.outletIds.filter((o) => o !== id) : [...x.outletIds, id] }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (person) await api.patch(`/admin/staff/${person.id}`, { name: f.name, isActive: f.isActive, outletIds: f.outletIds, ...(f.password ? { password: f.password } : {}) });
      else await api.post('/admin/staff', { name: f.name, email: f.email, phone: f.phone || undefined, password: f.password, outletIds: f.outletIds });
      toast.success('Saved'); onSaved(); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={person ? `Edit ${person.name}` : 'Add staff member'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {!person && <Field label="Email (their login)"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>}
        <Field label={person ? 'New password (leave empty to keep)' : 'Password (min 10 characters)'} hint={person ? 'Setting a password logs them out everywhere.' : 'Share it with them privately.'}>
          <input className="input" type="text" autoComplete="off" minLength={10} required={!person} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <fieldset><legend className="label">Can work at</legend><div className="space-y-1">{outlets.map((o) => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.outletIds.includes(o.id)} onChange={() => toggleOutlet(o.id)} />{o.name}</label>)}</div></fieldset>
        {person && <label className="flex items-center gap-3 text-sm font-semibold"><Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />Account active</label>}
        <button className="btn btn-primary w-full" disabled={busy || f.outletIds.length === 0}>{busy ? <Spinner /> : 'Save'}</button>
      </form>
    </Modal>
  );
}

export default function Team() {
  const toast = useToast();
  const outlets = useAsync(() => api.get('/admin/outlets'), []);
  const staff = useAsync(() => api.get('/admin/staff'), []);
  const [outletEdit, setOutletEdit] = useState(null);
  const [qr, setQr] = useState(null);
  const [staffEdit, setStaffEdit] = useState(null);
  if ((outlets.loading && !outlets.data) || (staff.loading && !staff.data)) return <PageLoader />;
  if (outlets.error && !outlets.data) return <ErrorBox error={outlets.error} onRetry={outlets.reset} />;
  const names = Object.fromEntries(outlets.data.outlets.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Carts</h1><button className="btn btn-primary" onClick={() => setOutletEdit('new')}><FiPlus /> Add cart</button></div>
        <div className="grid gap-3 md:grid-cols-2">{outlets.data.outlets.map((o) => (
          <div key={o.id} className="card space-y-2 p-4">
            <div className="flex items-start justify-between"><div><h2 className="font-sans text-lg font-bold">{o.name}</h2><p className="text-xs text-ink-mute">{o.address || 'No address yet'} · code {o.code}</p></div>
              <span className={`badge ${o.isAcceptingOrders ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{o.isAcceptingOrders ? 'Taking orders' : 'Paused'}</span></div>
            <p className="text-sm text-ink-soft">UPI: {o.upi.vpa || <span className="text-amber-700">not set (UPI hidden from customers)</span>}</p>
            <div className="flex gap-2 pt-1"><button className="btn btn-ghost btn-sm" onClick={() => setOutletEdit(o)}><FiEdit2 /> Edit</button><button className="btn btn-dark btn-sm" onClick={() => setQr(o)}>QR code</button></div>
          </div>))}</div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">Staff</h2><button className="btn btn-primary" onClick={() => setStaffEdit('new')}><FiPlus /> Add staff</button></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Carts</th><th>Last login</th><th>Status</th><th /></tr></thead>
          <tbody>{(staff.data?.staff || []).map((s) => (<tr key={s.id}><td className="font-semibold">{s.name}</td><td>{s.email}</td><td>{s.outletIds.map((id) => names[id]).filter(Boolean).join(', ')}</td><td>{s.lastLoginAt ? dateTime(s.lastLoginAt) : '—'}</td>
            <td><span className={`badge ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-ink/10 text-ink-soft'}`}>{s.isActive ? 'Active' : 'Disabled'}</span></td>
            <td className="whitespace-nowrap text-right"><button className="p-2" aria-label={`Edit ${s.name}`} onClick={() => setStaffEdit(s)}><FiEdit2 /></button>
              <button className="p-2 text-red-600" aria-label={`Delete ${s.name}`} onClick={async () => { if (!window.confirm(`Remove ${s.name}?`)) return; try { await api.del(`/admin/staff/${s.id}`); staff.reload(); } catch (e) { toast.error(e.message); } }}><FiTrash2 /></button></td></tr>))}
            {staff.data?.staff.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-mute">No staff yet. Add the person who works at the cart.</td></tr>}</tbody></table></div>
      </section>

      {outletEdit && <OutletForm outlet={outletEdit === 'new' ? null : outletEdit} onClose={() => setOutletEdit(null)} onSaved={outlets.reload} />}
      {qr && <QrModal outlet={qr} onClose={() => setQr(null)} />}
      {staffEdit && <StaffForm person={staffEdit === 'new' ? null : staffEdit} outlets={outlets.data.outlets} onClose={() => setStaffEdit(null)} onSaved={staff.reload} />}
    </div>
  );
}
