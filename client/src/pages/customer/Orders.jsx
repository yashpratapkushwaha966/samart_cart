import { Link } from 'react-router-dom';
import { FiClipboard } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useRealtime } from '../../hooks/useRealtime.js';
import { EmptyState, ErrorBox, PageLoader, PaymentBadge, StatusBadge } from '../../components/ui.jsx';
import { dateTime, rupees } from '../../utils/format.js';

export default function Orders() {
  const { data, loading, error, reload } = useAsync(() => api.get('/orders'), []);
  useRealtime({ 'order:updated': reload }, reload, 20000);
  if (loading && !data) return <PageLoader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">My orders</h1>
      {data.orders.length === 0 ? <EmptyState icon={FiClipboard} title="No orders yet" hint="Your orders will show up here." action={<Link to="/menu" className="btn btn-primary mt-2">Order momos</Link>} /> : (
        <ul className="space-y-3">
          {data.orders.map((o) => (
            <li key={o.id}><Link to={`/order/${o.id}`} className="card block p-4 transition hover:shadow-lg">
              <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-sm font-bold">{o.orderNumber}</p><p className="text-xs text-ink-mute">{dateTime(o.createdAt)}</p></div><span className="font-bold">{rupees(o.totalPaise)}</span></div>
              <p className="mt-2 line-clamp-1 text-sm text-ink-soft">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
              <div className="mt-2 flex gap-2"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></div>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
