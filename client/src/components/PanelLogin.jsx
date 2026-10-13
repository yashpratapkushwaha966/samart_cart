import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Spinner } from './ui.jsx';

// Shared sign-in screen for the staff and admin panels (email + password; accounts are created by the owner).
export default function PanelLogin({ role, title, home }) {
  const { user, passwordLogin, logout } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user?.role === role) return <Navigate to={home} replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const u = await passwordLogin(email, password);
      if (u.role !== role) { await logout(); setError('This account cannot use this panel.'); return; }
      const next = sp.get('next');
      nav(next && next.startsWith(home) ? next : home, { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-cream p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center"><div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-3xl">🥟</div>
          <h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-ink-soft">Smart Momos</p></div>
        <Field label="Email"><input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? <Spinner /> : <><FiLock /> Sign in</>}</button>
      </form>
    </div>
  );
}
