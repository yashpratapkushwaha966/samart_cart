// A slow, endless scrolling text strip (pure CSS, no JavaScript running).
export default function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden bg-night py-3 text-snow" aria-hidden="true">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-2xl font-bold uppercase tracking-wide sm:text-4xl">
        {row.map((t, i) => <span key={i}>{t} <span className="text-brand-400">✦</span></span>)}
      </div>
    </div>
  );
}
