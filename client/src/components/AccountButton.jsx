import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronDown, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import AccountMenu from './AccountMenu.jsx';

// Header button: "Log in" when signed out, "Account" with a drop-down when signed in.
export default function AccountButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  if (!user) return <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10">Log in</Link>;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10">
        <FiUser /> Account <FiChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl bg-surface p-2 shadow-2xl ring-1 ring-ink/10">
            <AccountMenu />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
