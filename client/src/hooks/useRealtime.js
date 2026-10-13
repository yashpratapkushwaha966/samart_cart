import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket.js';

/**
 * Listens to live events AND polls as a safety net (phones lose connections in pockets and tunnels).
 *   useRealtime({ 'order:new': fn, 'order:updated': fn }, refreshFn, 12000)
 * Returns whether the live connection is currently up.
 */
export function useRealtime(handlers, onPoll, pollMs = 12000) {
  const ref = useRef({ handlers, onPoll });
  ref.current = { handlers, onPoll };
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const names = Object.keys(ref.current.handlers);
    const bound = names.map((n) => [n, (payload) => ref.current.handlers[n]?.(payload)]);
    bound.forEach(([n, fn]) => socket.on(n, fn));
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    socket.on('connect', up); socket.on('disconnect', down); setConnected(socket.connected);
    return () => { bound.forEach(([n, fn]) => socket.off(n, fn)); socket.off('connect', up); socket.off('disconnect', down); };
  }, []);

  useEffect(() => {
    if (!pollMs) return undefined;
    const t = setInterval(() => { if (!document.hidden) ref.current.onPoll?.(); }, pollMs);
    const vis = () => { if (!document.hidden) ref.current.onPoll?.(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [pollMs]);
  return connected;
}
