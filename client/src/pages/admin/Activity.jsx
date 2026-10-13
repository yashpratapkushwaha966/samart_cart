import { useState } from 'react';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui.jsx';
import { dateTime } from '../../utils/format.js';

const ACTIONS = ['order.create', 'order.status', 'payment.confirm', 'payment.refund', 'payment.verify', 'alert', 'product.create', 'product.update', 'product.delete', 'offer.create', 'offer.update', 'staff.create', 'staff.update', 'outlet.update', 'settings.update', 'auth.login'];

export default function Activity() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reset } = useAsync(() => api.get('/admin/audit', { action: action || undefined, page }), [action, page]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Activity log</h1>
      <select className="input w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter by action"><option value="">All activity</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
      {loading && !data ? <PageLoader /> : error && !data ? <ErrorBox error={error} onRetry={reset} /> : data.logs.length === 0 ? <EmptyState title="Nothing here yet" /> : (
        <>
          <div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>{data.logs.map((l) => (<tr key={l.id}><td className="whitespace-nowrap">{dateTime(l.at)}</td><td>{l.actor?.name || l.actor?.email || l.actorRole}<span className="ml-1 text-xs text-ink-mute">({l.actorRole})</span></td>
              <td className={`font-mono text-xs font-bold ${l.action === 'alert' ? 'text-red-600' : ''}`}>{l.action}</td><td className="max-w-md break-words text-xs text-ink-soft">{l.meta ? JSON.stringify(l.meta) : ''}</td></tr>))}</tbody></table></div>
          <div className="flex items-center justify-end gap-2 text-sm"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {data.page} / {data.pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>
        </>
      )}
    </div>
  );
}
