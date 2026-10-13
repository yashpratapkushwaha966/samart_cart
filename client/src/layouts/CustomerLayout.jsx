import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiHome, FiGrid, FiShoppingBag, FiUser } from 'react-icons/fi';
import { useCart } from '../context/CartContext.jsx';
import { useMenu } from '../context/MenuContext.jsx';
import AccountButton from '../components/AccountButton.jsx';
import CartDrawer from '../components/CartDrawer.jsx';
import { rupees } from '../utils/format.js';

// Order history is NOT a main tab. It lives inside "Me" (Profile) so the front stays simple.
const tabs = [
  { to: '/', label: 'Home', icon: FiHome, end: true },
  { to: '/menu', label: 'Menu', icon: FiGrid },
  { to: '/account', label: 'Account', icon: FiUser },
];

export default function CustomerLayout() {
  const { count, items } = useCart();
  const { menu, productById } = useMenu();
  const loc = useLocation();
  const nav = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  useEffect(() => { setDrawer(false); }, [loc.pathname]); // the cart panel always closes when you go to another page
  const onCartPage = ['/cart', '/checkout'].includes(loc.pathname); // these pages already show the order list
  const total = items.reduce((s, i) => s + (productById(i.productId)?.pricePaise || 0) * i.quantity, 0);
  const showBar = count > 0 && !drawer && !['/cart', '/checkout'].includes(loc.pathname) && !loc.pathname.startsWith('/order/');

  return (
    <div className="min-h-screen pb-28 sm:pb-8">
      <header className="sticky top-0 z-30 bg-night text-snow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2"><span className="text-2xl">🥟</span>
            <span className="min-w-0 truncate font-display text-lg font-bold leading-none">{menu?.business.name || 'Smart Momos'}
              {menu && <span className="block font-sans text-[11px] font-medium text-white/50">{menu.outlet.name}</span>}</span></Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {tabs.slice(0, 2).map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-white/15' : 'text-white/70 hover:bg-white/10'}`}>{t.label}</NavLink>)}
            <span className="hidden sm:block"><AccountButton /></span>
          </nav>
          <button onClick={() => (onCartPage ? nav('/cart') : setDrawer(true))} className="relative rounded-xl bg-white/10 p-2.5 hover:bg-white/20" aria-label={`Open cart, ${count} items`}>
            <FiShoppingBag className="h-5 w-5" />
            {count > 0 && <motion.span key={count} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white">{count}</motion.span>}
          </button>
        </div>
      </header>

      <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={loc.pathname === '/' ? '' : 'mx-auto max-w-5xl px-4 py-5'}>
        <Outlet />
      </motion.main>

      {showBar && (
        <button onClick={() => setDrawer(true)} className="fixed inset-x-3 bottom-[4.5rem] z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-brand-500 px-5 py-3.5 text-white shadow-2xl sm:bottom-6">
          <span className="text-sm font-semibold">{count} item{count > 1 ? 's' : ''} · {rupees(total)}</span><span className="text-sm font-bold">View cart →</span>
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-night pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Main">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink to={t.to} end={t.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-400' : 'text-white/50'}`}>
                <t.icon className="h-5 w-5" />{t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <CartDrawer open={drawer} onClose={closeDrawer} />
    </div>
  );
}
