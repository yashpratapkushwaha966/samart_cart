import { rupees } from '../utils/format.js';

// A light, dependency-free bar chart. data: [{ label, value, sub }]
export default function BarChart({ data, height = 180, money = true }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label="Bar chart">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${money ? rupees(d.value) : d.value}${d.sub ? ` · ${d.sub}` : ''}`}>
            <div className="w-full rounded-t-md bg-brand-500/90 transition-all group-hover:bg-brand-600" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 1, opacity: d.value ? 1 : 0.2 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate text-center text-[10px] text-ink-mute">{data.length > 16 && i % 2 ? '' : d.label}</span>
        ))}
      </div>
    </div>
  );
}
