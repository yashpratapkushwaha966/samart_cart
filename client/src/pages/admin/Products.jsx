import { useState } from 'react';
import { FiEdit2, FiPlus, FiTrash2, FiUpload, FiList } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import FoodImage from '../../components/FoodImage.jsx';
import { ConfirmModal, EmptyState, ErrorBox, Field, Modal, PageLoader, Spinner, Toggle } from '../../components/ui.jsx';
import { rupees, toPaise, toRupeeText } from '../../utils/format.js';

const blank = (cat) => ({ name: '', description: '', price: '', imageUrl: '', category: cat || '', isVeg: true, isFeatured: false, isAvailable: true, sortOrder: 0 });

function ProductForm({ product, categories, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(product ? { ...product, price: toRupeeText(product.pricePaise) } : blank(categories[0]?.id));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const upload = async (file) => {
    if (!file) return; setBusy(true);
    try { set('imageUrl', (await api.upload('/admin/uploads', file)).url); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = { name: f.name.trim(), description: f.description.trim(), pricePaise: toPaise(f.price), imageUrl: f.imageUrl, category: f.category, isVeg: f.isVeg, isFeatured: f.isFeatured, isAvailable: f.isAvailable, sortOrder: Number(f.sortOrder) || 0 };
    try { if (product) await api.patch(`/admin/products/${product.id}`, body); else await api.post('/admin/products', body); toast.success('Saved'); onSaved(); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={product ? 'Edit product' : 'Add product'}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-center gap-3"><FoodImage src={f.imageUrl} alt="Preview" className="h-20 w-20 shrink-0 rounded-xl" />
          <label className="btn btn-ghost btn-sm cursor-pointer"><FiUpload /> Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files[0])} /></label>
          {f.imageUrl && <button type="button" className="text-xs text-red-600" onClick={() => set('imageUrl', '')}>Remove</button>}</div>
        <Field label="Name"><input className="input" required maxLength={80} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Description"><textarea className="input" rows={2} maxLength={500} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)"><input className="input" required type="number" min="1" step="0.5" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          <Field label="Category"><select className="input" required value={f.category} onChange={(e) => set('category', e.target.value)}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[['isVeg', 'Vegetarian'], ['isFeatured', 'Show as popular'], ['isAvailable', 'Available now']].map(([k, l]) => <label key={k} className="flex items-center gap-2"><Toggle checked={f[k]} onChange={(v) => set(k, v)} label={l} />{l}</label>)}
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Save product'}</button>
      </form>
    </Modal>
  );
}

function Categories({ onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.get('/admin/categories'), []);
  const [name, setName] = useState('');
  const run = async (fn) => { try { await fn(); await reload(); onChanged(); } catch (e) { toast.error(e.message); } };
  return (
    <Modal open onClose={onClose} title="Categories">
      {loading && !data ? <PageLoader /> : (
        <div className="space-y-3">
          <ul className="space-y-2">{data.categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-ink/[.04] p-2">
              <input className="input flex-1" defaultValue={c.name} aria-label="Category name" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => api.patch(`/admin/categories/${c.id}`, { name: e.target.value.trim() }))} />
              <span className="text-xs text-ink-mute">{c.products} items</span>
              <Toggle checked={c.isActive} label={`${c.name} visible`} onChange={(v) => run(() => api.patch(`/admin/categories/${c.id}`, { isActive: v }))} />
              <button className="p-2 text-red-600" aria-label={`Delete ${c.name}`} onClick={() => window.confirm(`Delete "${c.name}"?`) && run(() => api.del(`/admin/categories/${c.id}`))}><FiTrash2 /></button></li>))}</ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(async () => { await api.post('/admin/categories', { name: name.trim(), sortOrder: data.categories.length }); setName(''); }); }}>
            <input className="input" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-primary">Add</button></form>
        </div>
      )}
    </Modal>
  );
}

export default function Products() {
  const toast = useToast();
  const prods = useAsync(() => api.get('/admin/products'), []);
  const cats = useAsync(() => api.get('/admin/categories'), []);
  const [edit, setEdit] = useState(null); // product | 'new'
  const [del, setDel] = useState(null);
  const [showCats, setShowCats] = useState(false);
  const reloadAll = () => { prods.reload(); cats.reload(); };

  if ((prods.loading && !prods.data) || (cats.loading && !cats.data)) return <PageLoader />;
  if (prods.error && !prods.data) return <ErrorBox error={prods.error} onRetry={prods.reset} />;
  const toggle = async (p, k, v) => { try { await api.patch(`/admin/products/${p.id}`, { [k]: v }); prods.reload(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-bold">Menu</h1>
        <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setShowCats(true)}><FiList /> Categories</button><button className="btn btn-primary" onClick={() => setEdit('new')} disabled={!cats.data?.categories.length}><FiPlus /> Add product</button></div></div>
      {!cats.data?.categories.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Create a category first, then add products.</p>}
      {prods.data.products.length === 0 ? <EmptyState title="No products yet" hint="Add your first momos item." /> : (
        <div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Popular</th><th>Available</th><th /></tr></thead>
          <tbody>{prods.data.products.map((p) => (
            <tr key={p.id}><td><div className="flex items-center gap-3"><FoodImage src={p.imageUrl} alt={p.name} className="h-11 w-11 shrink-0 rounded-lg" /><div><p className="font-semibold">{p.name}</p><p className="line-clamp-1 max-w-[260px] text-xs text-ink-mute">{p.description}</p></div></div></td>
              <td>{p.categoryName}</td><td className="font-semibold">{rupees(p.pricePaise)}</td>
              <td><Toggle checked={p.isFeatured} label={`${p.name} popular`} onChange={(v) => toggle(p, 'isFeatured', v)} /></td>
              <td><Toggle checked={p.isAvailable} label={`${p.name} available`} onChange={(v) => toggle(p, 'isAvailable', v)} /></td>
              <td className="whitespace-nowrap text-right"><button className="p-2" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><FiEdit2 /></button><button className="p-2 text-red-600" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><FiTrash2 /></button></td></tr>))}</tbody></table></div>
      )}
      {edit && <ProductForm product={edit === 'new' ? null : edit} categories={cats.data.categories} onClose={() => setEdit(null)} onSaved={reloadAll} />}
      {showCats && <Categories onClose={() => setShowCats(false)} onChanged={reloadAll} />}
      <ConfirmModal open={Boolean(del)} danger title={`Delete ${del?.name}?`} message="It disappears from the menu. Old orders keep their original name and price." confirmLabel="Delete"
        onClose={() => setDel(null)} onConfirm={async () => { try { await api.del(`/admin/products/${del.id}`); toast.success('Deleted'); setDel(null); reloadAll(); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
