import { Outlet, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-ink/[.04]">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white">
        <div className="flex items-center gap-2"><span className="text-2xl">🥟</span><div className="leading-tight"><p className="font-display font-bold">Cart Orders</p><p className="text-xs text-white/60">{user.name || user.email}</p></div></div>
        <button className="btn btn-sm bg-white/10 text-white hover:bg-white/20" onClick={async () => { await logout(); nav('/staff/login'); }}><FiLogOut /> Log out</button>
      </header>
      <main className="mx-auto max-w-3xl px-3 py-4"><Outlet /></main>
    </div>
  );
}
