import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { useCart } from '../../context/CartContext.jsx';
import { useMenu } from '../../context/MenuContext.jsx';
import { Stepper } from '../../components/ProductCard.jsx';
import FoodImage from '../../components/FoodImage.jsx';
import { EmptyState, PageLoader } from '../../components/ui.jsx';
import { rupees } from '../../utils/format.js';

export default function Cart() {
  const cart = useCart();
  const { menu, loading, productById } = useMenu();
  const nav = useNavigate();
  if (loading && !menu) return <PageLoader />;
  const lines = cart.items.map((i) => ({ ...i, product: productById(i.productId) })).filter((l) => l.product);
  if (lines.length === 0) return <EmptyState icon={FiShoppingBag} title="Your cart is empty" hint="Add some hot momos to get started." action={<Link to="/menu" className="btn btn-primary mt-2">Browse menu</Link>} />;
  const subtotal = lines.reduce((s, l) => s + l.product.pricePaise * l.quantity, 0);
  const blocked = lines.some((l) => !l.product.isAvailable);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Your cart</h1><button className="text-sm font-semibold text-red-600" onClick={cart.clear}>Clear all</button></div>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.productId} className="card flex items-center gap-3 p-3">
            <FoodImage src={l.product.imageUrl} alt={l.product.name} className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.product.name}</p><p className="text-sm text-ink-soft">{rupees(l.product.pricePaise)} each</p>
              {!l.product.isAvailable && <p className="text-xs font-semibold text-red-600">No longer available. Please remove it.</p>}</div>
            <div className="flex flex-col items-end gap-2">
              <Stepper qty={l.quantity} label={l.product.name} onMinus={() => cart.setQty(l.productId, l.quantity - 1)} onPlus={() => cart.add(l.productId)} />
              <span className="text-sm font-bold">{rupees(l.product.pricePaise * l.quantity)}</span>
            </div>
            <button className="p-2 text-ink-mute hover:text-red-600" onClick={() => cart.remove(l.productId)} aria-label={`Remove ${l.product.name}`}><FiTrash2 /></button>
          </li>
        ))}
      </ul>
      <div className="card space-y-1 p-4">
        <div className="flex justify-between font-semibold"><span>Subtotal</span><span>{rupees(subtotal)}</span></div>
        <p className="text-xs text-ink-mute">Offers, fees and the final amount are calculated securely at checkout.</p>
      </div>
      <button className="btn btn-primary btn-lg w-full" disabled={blocked} onClick={() => nav('/checkout')}>Go to checkout</button>
    </div>
  );
}
