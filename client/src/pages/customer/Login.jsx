import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { FiMail } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Field, Spinner } from '../../components/ui.jsx';

const GOOGLE = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function Login() {
  const { user, requestOtp, verifyOtp, googleLogin } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/menu';
  const [step, setStep] = useState('email');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (cooldown <= 0) return undefined; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  if (user?.role === 'customer') return <Navigate to={dest} replace />;

  const run = async (fn) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const send = (e) => { e?.preventDefault(); return run(async () => { await requestOtp(email.trim(), name.trim(), phone.trim()); setStep('code'); setCooldown(60); toast.info('We emailed you a 6-digit code'); }); };
  const verify = (e) => { e.preventDefault(); return run(async () => { await verifyOtp(email.trim(), code.trim(), name.trim(), phone.trim()); nav(dest, { replace: true }); }); };
  const google = (res) => run(async () => { await googleLogin(res.credential); nav(dest, { replace: true }); });

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div className="text-center"><h1 className="text-3xl font-bold">Log in to order</h1><p className="text-sm text-ink-soft">No password needed. Tell us who you are and we email you a one-time code.</p></div>
      <div className="card space-y-4 p-5">
        {step === 'email' ? (
          <form onSubmit={send} className="space-y-4">
            <Field label="Full name"><input className="input" autoComplete="name" required minLength={2} maxLength={80} placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Contact number"><input className="input" type="tel" inputMode="tel" autoComplete="tel" required pattern="[0-9+\-\s]{7,15}" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Email" hint="We send the one-time code here"><input className="input" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? <Spinner /> : <><FiMail /> Send code</>}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-ink-soft">Enter the code sent to <b>{email}</b></p>
            <Field label="6-digit code"><input className="input text-center text-2xl tracking-[.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
            <button className="btn btn-primary btn-lg w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : 'Verify & continue'}</button>
            <div className="flex justify-between text-sm"><button type="button" className="font-semibold text-ink-soft" onClick={() => { setStep('email'); setCode(''); setError(''); }}>Change email</button>
              <button type="button" className="font-semibold text-brand-600 disabled:text-ink-mute" disabled={cooldown > 0 || busy} onClick={send}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button></div>
          </form>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        {GOOGLE && (<><div className="flex items-center gap-3 text-xs text-ink-mute"><span className="h-px flex-1 bg-ink/10" />or<span className="h-px flex-1 bg-ink/10" /></div>
          <div className="flex justify-center"><GoogleLogin onSuccess={google} onError={() => setError('Google sign-in failed. Please try again.')} text="continue_with" shape="pill" /></div></>)}
      </div>
    </div>
  );
}
