import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiMinus, FiPlus } from 'react-icons/fi';
import FoodImage from './FoodImage.jsx';
import { Modal } from './ui.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { rupees } from '../utils/format.js';

const VegDot = ({ veg }) => (
  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border-2 ${veg ? 'border-leaf' : 'border-red-600'}`} title={veg ? 'Vegetarian' : 'Non-vegetarian'}>
    <span className={`h-2 w-2 rounded-full ${veg ? 'bg-leaf' : 'bg-red-600'}`} />
  </span>
);

export function Stepper({ qty, onMinus, onPlus, label }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-brand-500 text-white" role="group" aria-label={`Quantity of ${label}`}>
      <button className="p-2.5" onClick={onMinus} aria-label={`Remove one ${label}`}><FiMinus /></button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold" aria-live="polite">{qty}</span>
      <button className="p-2.5" onClick={onPlus} aria-label={`Add one ${label}`}><FiPlus /></button>
    </div>
  );
}

export function ProductSheet({ product, onClose }) {
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  if (!product) return null;
  const add = () => { cart.add(product.id, qty); toast.success(`${qty} × ${product.name} added`); onClose(); };
  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product.name}>
      <FoodImage src={product.imageUrl} alt={product.name} className="mb-4 h-48 w-full rounded-2xl" />
      <div className="mb-2 flex items-center gap-2"><VegDot veg={product.isVeg} /><span className="text-lg font-bold text-brand-600">{rupees(product.pricePaise)}</span></div>
      <p className="mb-5 text-sm text-ink-soft">{product.description || 'Freshly made at the cart.'}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border border-ink/15">
          <button className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><FiMinus /></button>
          <span className="min-w-[2rem] text-center font-bold">{qty}</span>
          <button className="p-3" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Increase quantity"><FiPlus /></button>
        </div>
        <button className="btn btn-primary btn-lg flex-1" disabled={!product.isAvailable} onClick={add}>
          {product.isAvailable ? `Add · ${rupees(product.pricePaise * qty)}` : 'Unavailable'}
        </button>
      </div>
    </Modal>
  );
}

export default function ProductCard({ product, onOpen }) {
  const cart = useCart();
  const qty = cart.qtyOf(product.id);
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
      className={`card flex gap-3 overflow-hidden p-3 sm:flex-col sm:p-0 ${product.isAvailable ? '' : 'opacity-60'}`}>
      <button onClick={() => onOpen(product)} className="shrink-0 text-left sm:w-full" aria-label={`View ${product.name}`}>
        <FoodImage src={product.imageUrl} alt={product.name} className="h-24 w-24 rounded-xl sm:h-44 sm:w-full sm:rounded-none" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col sm:p-3 sm:pt-0">
        <div className="flex items-center gap-2"><VegDot veg={product.isVeg} /><h3 className="truncate font-sans text-base font-semibold">{product.name}</h3></div>
        <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold">{rupees(product.pricePaise)}</span>
          {!product.isAvailable ? <span className="badge bg-ink/10 text-ink-soft">Sold out</span>
            : qty > 0 ? <Stepper qty={qty} label={product.name} onMinus={() => cart.setQty(product.id, qty - 1)} onPlus={() => cart.add(product.id)} />
              : <button className="btn btn-sm border-2 border-brand-500 bg-surface text-brand-600 hover:bg-brand-50" onClick={() => cart.add(product.id)}>ADD</button>}
        </div>
      </div>
    </motion.article>
  );
}
