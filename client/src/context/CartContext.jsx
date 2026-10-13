import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { safeStorage } from '../utils/format.js';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);
const KEY = 'momos.cart.v1';
const MAX = 20;

// The basket lives only in this browser. Prices are NOT stored here; the server recalculates everything at checkout.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => safeStorage.get(KEY, []));
  useEffect(() => { safeStorage.set(KEY, items); }, [items]);

  const value = useMemo(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    qtyOf: (id) => items.find((i) => i.productId === id)?.quantity || 0,
    add: (id, qty = 1) => setItems((l) => {
      const hit = l.find((i) => i.productId === id);
      if (!hit) return [...l, { productId: id, quantity: Math.min(qty, MAX) }];
      return l.map((i) => (i.productId === id ? { ...i, quantity: Math.min(i.quantity + qty, MAX) } : i));
    }),
    setQty: (id, qty) => setItems((l) => (qty <= 0 ? l.filter((i) => i.productId !== id) : l.map((i) => (i.productId === id ? { ...i, quantity: Math.min(qty, MAX) } : i)))),
    remove: (id) => setItems((l) => l.filter((i) => i.productId !== id)),
    clear: () => setItems([]),
    prune: (validIds) => setItems((l) => l.filter((i) => validIds.has(i.productId))),
  }), [items]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
