import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, message, ms = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), ms);
  }, []);
  const api = useMemo(() => ({
    success: (m, ms) => push('success', m, ms), error: (m, ms) => push('error', m, ms ?? 6000), info: (m, ms) => push('info', m, ms),
  }), [push]);
  const icon = { success: <FiCheckCircle className="text-leaf" />, error: <FiAlertCircle className="text-red-600" />, info: <FiInfo className="text-brand-600" /> };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-medium shadow-card ring-1 ring-ink/10">
              {icon[t.kind]}<span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
