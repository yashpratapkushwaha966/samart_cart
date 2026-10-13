import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiTrash2, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext.jsx';
import { useMenu } from '../context/MenuContext.jsx';
import { Stepper } from './ProductCard.jsx';
import FoodImage from './FoodImage.jsx';
import { rupees } from '../utils/format.js';

// "Your order" panel that slides in from the right. The full /cart page still exists as well.
export default function CartDrawer({ open, onClose }) {
  const cart = useCart();
  const nav = useNavigate();
  const { productById } = useMenu();
  const lines = cart.items.map((i) => ({ ...i, product: productById(i.productId) })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.pricePaise * l.quantity, 0);
  const blocked = lines.some((l) => !l.product.isAvailable);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Go to checkout: close this panel first, then open the checkout page.
  const goCheckout = () => { onClose(); nav('/checkout'); };

  if (!open) return null; // closes at once (no exit animation that could get stuck)

  return (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.aside role="dialog" aria-modal="true" aria-label="Your order"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-night text-snow shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'tween', duration: 0.28 }}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <h2 className="font-display text-2xl font-bold">Your order</h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close cart"><FiX className="h-6 w-6" /></button>
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
                <FiShoppingBag className="h-14 w-14 text-white/50" />
                <p className="font-sans text-lg font-semibold">Your cart is empty</p>
                <p className="font-display italic text-white/60">The steamer is hot though. Add something warm.</p>
                <Link to="/menu" onClick={onClose} className="btn btn-primary mt-3">Browse menu</Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {lines.map((l) => (
                    <li key={l.productId} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                      <FoodImage src={l.product.imageUrl} alt={l.product.name} className="h-14 w-14 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{l.product.name}</p>
                        <p className="text-sm text-white/60">{rupees(l.product.pricePaise * l.quantity)}</p>
                        {!l.product.isAvailable && <p className="text-xs font-semibold text-red-400">Sold out. Please remove it.</p>}
                      </div>
                      <Stepper qty={l.quantity} label={l.product.name} onMinus={() => cart.setQty(l.productId, l.quantity - 1)} onPlus={() => cart.add(l.productId)} />
                      <button className="p-2 text-white/50 hover:text-red-400" onClick={() => cart.remove(l.productId)} aria-label={`Remove ${l.product.name}`}><FiTrash2 /></button>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3 border-t border-white/10 px-5 py-4">
                  <div className="flex justify-between text-lg font-bold"><span>Subtotal</span><span>{rupees(subtotal)}</span></div>
                  <p className="text-xs text-white/50">Offers, fees and the final amount are calculated securely at checkout.</p>
                  <button onClick={goCheckout} disabled={blocked} className="btn btn-primary btn-lg w-full">Go to checkout</button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
  );
}
