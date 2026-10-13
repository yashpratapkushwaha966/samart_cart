import { Link, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiClipboard, FiEdit2, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import ThemePicker from './ThemePicker.jsx';

function Row({ to, icon: Icon, label, hint }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-ink/5 active:bg-ink/10">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Icon /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block truncate text-xs text-ink-soft">{hint}</span>}</span>
      <FiChevronRight className="text-ink-mute" />
    </Link>
  );
}

// The same options show in the Account page and in the header drop-down.
export default function AccountMenu() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="text-ink">
      <Row to="/account/edit" icon={FiEdit2} label="Edit profile" hint="Name and contact number" />
      <Row to="/orders" icon={FiClipboard} label="Order history" hint="Your past and current orders" />
      <div className="px-3 py-3"><p className="mb-2 text-sm font-semibold">Change theme</p><ThemePicker /></div>
      <button onClick={async () => { await logout(); nav('/'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-red-500/10">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600"><FiLogOut /></span>
        <span className="text-sm font-semibold text-red-600">Log out</span>
      </button>
    </div>
  );
}
