import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Field, Spinner } from '../../components/ui.jsx';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [busy, setBusy] = useState(false);
  const incomplete = !user.name || !user.phone;

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      setUser((await api.patch('/auth/me', { name: name.trim(), phone: phone.trim() })).user);
      toast.success('Profile saved');
      // Save takes you one step back (for example to the Account page, or on to checkout).
      if (next && next.startsWith('/') && !next.startsWith('//')) nav(next, { replace: true });
      else if (loc.key === 'default') nav('/account', { replace: true });
      else nav(-1);
    } catch (err) { toast.error(err.message); setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft"><FiChevronLeft /> Account</Link>
      <h1 className="text-3xl font-bold">Edit profile</h1>
      {incomplete && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">Please add your full name and contact number. We need them to place your order.</p>}
      <form onSubmit={save} className="card space-y-4 p-5">
        <Field label="Email"><input className="input bg-ink/5" value={user.email} disabled /></Field>
        <Field label="Full name" hint="Staff only see your first name."><input className="input" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Contact number"><input className="input" type="tel" inputMode="tel" autoComplete="tel" required pattern="[0-9+\-\s]{7,15}" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost flex-1" onClick={() => nav(-1)} disabled={busy}>Cancel</button>
          <button className="btn btn-primary flex-1" disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
