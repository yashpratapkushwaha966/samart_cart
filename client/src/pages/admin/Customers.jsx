import { useState } from 'react';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui.jsx';
import { dateTime, rupees } from '../../utils/format.js';

export default function Customers() {
  const [q, setQ] = useState('');
  const { data, loading, error, reset } = useAsync(() => api.get('/admin/customers', { q: q || undefined }), [q]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Customers</h1>
      <input className="input max-w-xs" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      {loading && !data ? <PageLoader /> : error && !data ? <ErrorBox error={error} onRetry={reset} /> : data.customers.length === 0 ? <EmptyState title="No customers yet" hint="Customers who place an order appear here." /> : (
        <div className="table-wrap"><table className="table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Paid total</th><th>Last order</th></tr></thead>
          <tbody>{data.customers.map((c) => <tr key={c.id}><td className="font-semibold">{c.name || '—'}</td><td>{c.email}</td><td>{c.phone || '—'}</td><td>{c.orders}</td><td>{rupees(c.spentPaise)}</td><td>{dateTime(c.lastOrderAt)}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
