import { useMemo, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useMenu } from '../../context/MenuContext.jsx';
import ProductCard, { ProductSheet } from '../../components/ProductCard.jsx';
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui.jsx';

export default function Menu() {
  const { menu, loading, error, reload } = useMenu();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    if (!menu) return [];
    const term = q.trim().toLowerCase();
    return menu.products.filter((p) => (cat === 'all' || p.categoryId === cat) && (!term || `${p.name} ${p.description}`.toLowerCase().includes(term)));
  }, [menu, cat, q]);

  if (loading && !menu) return <PageLoader label="Loading the menu…" />;
  if (error && !menu) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">Menu</h1>
        {!menu.outlet.isOpen && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">This cart is not taking orders right now. You can look around, but checkout will open when it is back.</p>}</div>
      <div className="relative"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input className="input pl-10" placeholder="Search momos…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the menu" /></div>
      <div className="no-scrollbar sticky top-[61px] z-20 -mx-4 flex gap-2 overflow-x-auto bg-cream/95 px-4 py-2 backdrop-blur" role="tablist" aria-label="Categories">
        {[{ id: 'all', name: 'All' }, ...menu.categories].map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c.id ? 'bg-brand-500 text-white' : 'bg-surface text-ink-soft shadow-card'}`}>{c.name}</button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState title="Nothing found" hint="Try a different word or category." />
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <ProductCard key={p.id} product={p} onOpen={setOpen} />)}</div>}
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </div>
  );
}
