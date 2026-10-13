import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Customer theme: Light, Dark, or Custom (pick an accent colour). Saved on this device only.
// The staff and owner panels always stay on the normal light theme.
export const ACCENTS = { orange: '#ef5a17', green: '#10b981', purple: '#8b5cf6', rose: '#f43f5e', blue: '#0ea5e9' };
const KEY = 'sm-theme';
const MODES = ['light', 'dark', 'custom'];

function load() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: MODES.includes(t.mode) ? t.mode : 'light', accent: ACCENTS[t.accent] ? t.accent : 'orange' };
  } catch { return { mode: 'light', accent: 'orange' }; }
}

const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }) {
  const [state, setState] = useState(load);
  const { pathname } = useLocation();
  const panel = /^\/(admin|staff)/.test(pathname);

  useEffect(() => {
    const h = document.documentElement;
    h.dataset.theme = !panel && state.mode === 'dark' ? 'dark' : 'light';
    if (!panel && state.mode === 'custom') h.dataset.accent = state.accent; else delete h.dataset.accent;
  }, [state, panel]);

  const update = useCallback((patch) => setState((s) => {
    const n = { ...s, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode: still works for this visit */ }
    return n;
  }), []);

  const value = useMemo(() => ({ ...state, setMode: (mode) => update({ mode }), setAccent: (accent) => update({ mode: 'custom', accent }) }), [state, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
