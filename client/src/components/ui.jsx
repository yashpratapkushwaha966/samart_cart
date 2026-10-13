import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX, FiAlertTriangle, FiInbox } from 'react-icons/fi';

export const Spinner = ({ className = '' }) => (
  <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} role="status" aria-label="Loading" />
);

export const PageLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-soft"><Spinner className="h-8 w-8 text-brand-500" /><p className="text-sm">{label}</p></div>
);

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-ink/10 ${className}`} />;

export function EmptyState({ icon: Icon = FiInbox, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/15 bg-white/60 px-6 py-12 text-center">
      <Icon className="h-10 w-10 text-ink-mute" /><h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-ink-soft">{hint}</p>}{action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-red-50 px-6 py-8 text-center text-red-800" role="alert">
      <FiAlertTriangle className="h-8 w-8" /><p className="text-sm font-medium">{error?.message || 'Something went wrong'}</p>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-ink/5" aria-label="Close"><FiX /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="mb-4 text-sm text-ink-soft">{message}</p>}
      {children}
      <div className="mt-5 flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onClose} disabled={busy}>Back</button>
        <button className={`btn flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? <Spinner /> : confirmLabel}</button>
      </div>
    </Modal>
  );
}

const ORDER_COLORS = {
  Placed: 'bg-blue-100 text-blue-800', Accepted: 'bg-indigo-100 text-indigo-800', Preparing: 'bg-amber-100 text-amber-800',
  Ready: 'bg-green-100 text-green-800', Completed: 'bg-ink/10 text-ink-soft', Cancelled: 'bg-red-100 text-red-700',
};
const PAY_COLORS = { Pending: 'bg-amber-100 text-amber-800', Paid: 'bg-green-100 text-green-800', Failed: 'bg-red-100 text-red-700', Cancelled: 'bg-ink/10 text-ink-soft', Refunded: 'bg-purple-100 text-purple-800' };
export const StatusBadge = ({ status }) => <span className={`badge ${ORDER_COLORS[status] || 'bg-ink/10'}`}>{status}</span>;
export const PaymentBadge = ({ status }) => <span className={`badge ${PAY_COLORS[status] || 'bg-ink/10'}`}>{status === 'Pending' ? 'Payment pending' : status}</span>;

export const StatCard = ({ label, value, hint, tone = 'default' }) => (
  <div className={`card p-4 ${tone === 'brand' ? 'bg-brand-500 text-white' : ''}`}>
    <p className={`text-xs font-semibold uppercase tracking-wide ${tone === 'brand' ? 'text-white/80' : 'text-ink-soft'}`}>{label}</p>
    <p className="mt-1 text-2xl font-bold">{value}</p>
    {hint && <p className={`mt-0.5 text-xs ${tone === 'brand' ? 'text-white/80' : 'text-ink-mute'}`}>{hint}</p>}
  </div>
);

export function Field({ label, children, hint, error }) {
  return (
    <label className="block">
      <span className="label">{label}</span>{children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const Toggle = ({ checked, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-leaf' : 'bg-ink/20'} disabled:opacity-50`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);
