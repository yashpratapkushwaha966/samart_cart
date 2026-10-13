import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiGrid, FiShoppingBag, FiCoffee, FiTag, FiBarChart2, FiUsers, FiTruck, FiSettings, FiActivity, FiMenu, FiX, FiLogOut, FiMessageSquare } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useRealtime } from '../hooks/useRealtime.js';

const links = [
  ['/admin', 'Dashboard', FiGrid, true], ['/admin/orders', 'Orders', FiShoppingBag], ['/admin/menu', 'Menu', FiCoffee], ['/admin/offers', 'Offers', FiTag],
  ['/admin/reports', 'Reports', FiBarChart2], ['/admin/customers', 'Customers', FiUsers], ['/admin/feedback', 'Feedback', FiMessageSquare], ['/admin/team', 'Carts & Staff', FiTruck],
  ['/admin/settings', 'Settings', FiSettings], ['/admin/activity', 'Activity log', FiActivity],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  // Notifications for the owner: new orders, and payment problems that need a human.
  useRealtime({
    'order:new': (o) => toast.info(`🔔 New order ${o.orderNumber}`, 6000),
    alert: (a) => toast.error(`⚠️ ${a.message}`, 12000),
  }, null, 0);

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink p-4 text-white" aria-label="Admin">
      <div className="mb-6 flex items-center gap-2 px-2"><span className="text-2xl">🥟</span><div className="leading-tight"><p className="font-display text-lg font-bold">Smart Momos</p><p className="text-xs text-white/50">Owner panel</p></div></div>
      <ul className="flex-1 space-y-1">
        {links.map(([to, label, Icon, end]) => (
          <li key={to}><NavLink to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-500' : 'text-white/70 hover:bg-white/10'}`}><Icon />{label}</NavLink></li>
        ))}
      </ul>
      <div className="border-t border-white/10 pt-3"><p className="truncate px-2 text-xs text-white/50">{user.email}</p>
        <button className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10" onClick={async () => { await logout(); nav('/admin/login'); }}><FiLogOut /> Log out</button></div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink/[.04] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <span className="font-display font-bold">🥟 Smart Momos</span>
        <button onClick={() => setOpen(true)} aria-label="Open menu"><FiMenu className="h-6 w-6" /></button>
      </div>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} /><div className="absolute left-0 top-0 h-full w-64">{sidebar}</div>
        <button className="absolute right-4 top-4 text-white" onClick={() => setOpen(false)} aria-label="Close menu"><FiX className="h-6 w-6" /></button></div>}
      <main className="min-w-0 p-4 sm:p-6"><Outlet /></main>
    </div>
  );
}
