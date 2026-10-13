import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext.jsx';
import AccountMenu from '../../components/AccountMenu.jsx';

export default function Account() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const initial = (user.name || user.email || '?').trim()[0].toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="card flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">{initial}</span>
        <div className="min-w-0"><p className="truncate text-lg font-bold">{user.name || 'Your name'}</p><p className="truncate text-sm text-ink-soft">{user.email}</p><p className="text-sm text-ink-soft">{user.phone}</p></div>
      </div>
      {user.pin && (
        <div className="card p-4">
          <p className="label">Your personal PIN</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-3xl font-bold tracking-[.4em]" aria-live="polite">{show ? user.pin : '••••'}</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)}>{show ? <FiEyeOff /> : <FiEye />}{show ? 'Hide' : 'Show'}</button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">This is your pickup PIN. It is yours for good and the same for every order, like a ride OTP. Tell it to the staff when you collect. Do not share it with anyone else.</p>
        </div>
      )}
      <div className="card p-2"><AccountMenu /></div>
    </motion.div>
  );
}
