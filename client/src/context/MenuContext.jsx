import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { safeStorage } from '../utils/format.js';
import { useCart } from './CartContext.jsx';

const MenuCtx = createContext(null);
export const useMenu = () => useContext(MenuCtx);
const SLUG_KEY = 'momos.outlet.v1';

// Which cart am I ordering from? Set by the QR code (/c/<slug>) and remembered on this phone.
export function MenuProvider({ children }) {
  const [slug, setSlugState] = useState(() => safeStorage.get(SLUG_KEY, null));
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const cart = useCart();

  const setSlug = useCallback((s) => { safeStorage.set(SLUG_KEY, s); setSlugState(s); }, []);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      let current = slug;
      if (!current) { current = (await api.get('/public/outlets/default')).slug; setSlug(current); }
      let data;
      try { data = await api.get(`/public/outlets/${current}/menu`); } catch (e) {
        if (e.code === 'OUTLET_NOT_FOUND' && slug) { safeStorage.set(SLUG_KEY, null); setSlugState(null); return; } // stale QR/slug: fall back to default
        throw e;
      }
      setMenu(data); setError(null);
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [slug, setSlug]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => { // refresh availability when the person comes back to the tab
    const onVis = () => { if (!document.hidden) load(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);
  useEffect(() => { // drop basket items that were removed from the menu
    if (menu) cart.prune(new Set(menu.products.map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  const value = useMemo(() => ({
    menu, loading, error, slug, setSlug, reload: () => load(true),
    productById: (id) => menu?.products.find((p) => p.id === id),
  }), [menu, loading, error, slug, setSlug, load]);
  return <MenuCtx.Provider value={value}>{children}</MenuCtx.Provider>;
}
