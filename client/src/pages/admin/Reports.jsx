import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import BarChart from '../../components/BarChart.jsx';
import { ErrorBox, PageLoader, StatCard } from '../../components/ui.jsx';
import { rupees } from '../../utils/format.js';

const RANGES = [['daily', 'Daily · 30 days'], ['weekly', 'Weekly · 12 weeks'], ['monthly', 'Monthly · 12 months']];

export default function Reports() {
  const [range, setRange] = useState('daily');
  const { data, loading, error, reset } = useAsync(() => api.get('/admin/reports', { range }), [range]);

  const csv = () => {
    const rows = [['Period', 'Orders', 'Sales (INR)', 'Cash (INR)', 'UPI (INR)', 'Online (INR)'], ...data.series.map((r) => [r.bucket, r.orders, r.salesPaise / 100, r.cash / 100, r.upi / 100, r.online / 100])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `sales-${range}.csv` }).click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-bold">Sales reports</h1>
        <div className="flex gap-2"><div className="flex rounded-xl bg-surface p-1 shadow-card" role="tablist">{RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={`rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${range === k ? 'bg-ink text-white' : 'text-ink-soft'}`}>{l}</button>)}</div>
          <button className="btn btn-ghost" onClick={csv} disabled={!data} aria-label="Download CSV"><FiDownload /></button></div></div>
      {loading && !data ? <PageLoader /> : error && !data ? <ErrorBox error={error} onRetry={reset} /> : (
        <>
          <p className="text-sm text-ink-soft">Sales count only payments that are confirmed as <b>Paid</b>. Cancelled, pending and refunded money is not included.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard tone="brand" label="Total sales" value={rupees(data.totals.salesPaise)} /><StatCard label="Orders" value={data.totals.orders} />
            <StatCard label="Cash" value={rupees(data.totals.cash)} /><StatCard label="UPI" value={rupees(data.totals.upi)} /><StatCard label="Online" value={rupees(data.totals.online)} />
          </div>
          {data.refundedPaise > 0 && <p className="text-sm text-purple-700">Refunded in this period: {rupees(data.refundedPaise)}</p>}
          <section className="card p-4"><BarChart height={220} data={data.series.map((r) => ({ label: range === 'monthly' ? r.bucket.slice(0, 7) : r.bucket.slice(5), value: r.salesPaise, sub: `${r.orders} orders` }))} /></section>
          <div className="table-wrap"><table className="table"><thead><tr><th>{range === 'weekly' ? 'Week starting' : range === 'monthly' ? 'Month' : 'Date'}</th><th>Orders</th><th>Sales</th><th>Cash</th><th>UPI</th><th>Online</th></tr></thead>
            <tbody>{[...data.series].reverse().map((r) => <tr key={r.bucket}><td>{range === 'monthly' ? r.bucket.slice(0, 7) : r.bucket}</td><td>{r.orders}</td><td className="font-semibold">{rupees(r.salesPaise)}</td><td>{rupees(r.cash)}</td><td>{rupees(r.upi)}</td><td>{rupees(r.online)}</td></tr>)}</tbody></table></div>
        </>
      )}
    </div>
  );
}
