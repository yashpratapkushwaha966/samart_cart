import { FiStar, FiTrash2 } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui.jsx';
import { dateTime } from '../../utils/format.js';

const Stars = ({ n }) => <span className="inline-flex" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <FiStar key={i} className={i <= n ? 'fill-saffron text-saffron' : 'text-ink/20'} />)}</span>;

export default function Feedback() {
  const toast = useToast();
  const { data, loading, error, reset, reload } = useAsync(() => api.get('/admin/feedback'), []);
  const remove = async (id) => {
    if (!window.confirm('Delete this feedback?')) return;
    try { await api.del(`/admin/feedback/${id}`); toast.success('Deleted'); reload(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-bold">Feedback</h1>
        {data && data.count > 0 && <p className="text-sm text-ink-soft"><b className="text-2xl text-ink">{data.average}</b> / 5 average from {data.count} review{data.count > 1 ? 's' : ''}</p>}
      </div>
      {loading && !data ? <PageLoader /> : error && !data ? <ErrorBox error={error} onRetry={reset} /> : data.items.length === 0 ? <EmptyState title="No feedback yet" hint="What customers write at the bottom of the home page shows up here." /> : (
        <ul className="space-y-3">
          {data.items.map((f) => (
            <li key={f.id} className="card flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Stars n={f.rating} /><span className="font-semibold">{f.name}</span><span className="text-xs text-ink-mute">{dateTime(f.createdAt)}</span></div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{f.message}</p>
                {(f.email || f.phone) && <p className="mt-1 text-xs text-ink-mute">{[f.email, f.phone].filter(Boolean).join(' · ')}</p>}
              </div>
              <button className="p-2 text-red-600" onClick={() => remove(f.id)} aria-label="Delete feedback"><FiTrash2 /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
