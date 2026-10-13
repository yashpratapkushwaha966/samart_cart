import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useRealtime } from '../../hooks/useRealtime.js';
import BarChart from '../../components/BarChart.jsx';
import { ErrorBox, PageLoader, PaymentBadge, StatCard, StatusBadge } from '../../components/ui.jsx';
import { METHOD_LABEL, rupees, timeOf } from '../../utils/format.js';

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/dashboard'), []);
  useRealtime({ 'order:new': reload, 'order:updated': reload }, reload, 30000);
  if (loading && !data) return <PageLoader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { counts: c, sales: s, last7Days, popular, recentOrders } = data;
  const maxPop = Math.max(1, ...popular.map((p) => p.quantity));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="brand" label="Sales today" value={rupees(s.today.totalPaise)} hint={`${s.today.payments} paid`} />
        <StatCard label="Orders today" value={c.ordersToday} hint={`${c.completedToday} completed · ${c.cancelledToday} cancelled`} />
        <StatCard label="New (waiting)" value={c.newOrders} hint={`${c.inProgress} in progress`} />
        <StatCard label="Payments pending" value={c.pendingPayments} hint="on active orders" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="This week" value={rupees(s.week.totalPaise)} /><StatCard label="This month" value={rupees(s.month.totalPaise)} />
        <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Today by payment</p>
          <dl className="mt-1 space-y-0.5 text-sm">{['cash', 'upi', 'online'].map((m) => <div key={m} className="flex justify-between"><dt>{METHOD_LABEL[m]}</dt><dd className="font-bold">{rupees(s.today.byMethod[m])}</dd></div>)}</dl></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2"><h2 className="mb-3 text-lg font-bold">Sales, last 7 days</h2>
          <BarChart data={last7Days.map((d) => ({ label: d.bucket.slice(5), value: d.salesPaise, sub: `${d.orders} orders` }))} /></section>
        <section className="card p-4"><h2 className="mb-3 text-lg font-bold">Popular (30 days)</h2>
          {popular.length === 0 ? <p className="text-sm text-ink-mute">No sales yet.</p> : <ul className="space-y-3">{popular.map((p) => (
            <li key={p.name}><div className="flex justify-between text-sm"><span className="font-semibold">{p.name}</span><span>{p.quantity} sold</span></div>
              <div className="mt-1 h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(p.quantity / maxPop) * 100}%` }} /></div></li>))}</ul>}</section>
      </div>
      <section><h2 className="mb-3 text-lg font-bold">Recent orders</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Time</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>{recentOrders.map((o) => (<tr key={o.id}><td className="font-mono text-xs font-bold">{o.orderNumber}</td><td>{timeOf(o.createdAt)}</td><td>{o.customer.name || o.customer.email}</td><td className="font-semibold">{rupees(o.totalPaise)}</td><td><StatusBadge status={o.status} /></td><td><PaymentBadge status={o.paymentStatus} /></td></tr>))}
            {recentOrders.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-mute">No orders yet</td></tr>}</tbody></table></div></section>
    </div>
  );
}
