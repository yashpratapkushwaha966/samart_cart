import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { closeSocket } from '../services/socket.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser((await api.get('/auth/me')).user); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    user, loading, refresh, setUser,
    requestOtp: (email, name, phone) => api.post('/auth/otp/request', { email, name, phone }),
    verifyOtp: async (email, code, name, phone) => { const r = await api.post('/auth/otp/verify', { email, code, name, phone }); setUser(r.user); return r.user; },
    googleLogin: async (credential) => { const r = await api.post('/auth/google', { credential }); setUser(r.user); return r.user; },
    passwordLogin: async (email, password) => { const r = await api.post('/auth/login', { email, password }); setUser(r.user); return r.user; },
    logout: async () => { try { await api.post('/auth/logout'); } finally { closeSocket(); setUser(null); } },
  }), [user, loading, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
