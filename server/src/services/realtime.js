import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { resolveSession } from './authService.js';
import { serializeOrder } from './serializers.js';
import { getSettings } from './settings.js';
import { logger } from '../utils/logger.js';

let io = null;

const readCookie = (header = '', name) => {
  const hit = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

/**
 * Rooms: admin -> "admin", staff -> "outlet:<id>" for each assigned cart, customer -> "user:<id>".
 * A socket only joins rooms its own logged-in role allows, so one customer can never hear another's orders.
 */
export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientUrl, credentials: true } });

  io.use(async (socket, next) => {
    try {
      const found = await resolveSession(readCookie(socket.handshake.headers.cookie, 'sid'));
      if (!found) return next(new Error('unauthorized'));
      socket.data.user = found.user;
      return next();
    } catch (err) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u.role === 'admin') socket.join('admin');
    else if (u.role === 'staff') (u.outletIds || []).forEach((id) => socket.join(`outlet:${id}`));
    else socket.join(`user:${u._id}`);
  });
  return io;
}

// Sends the order to each audience in the shape that audience is allowed to see.
export async function emitOrderEvent(event, order) {
  if (!io) return;
  try {
    const settings = await getSettings();
    const outletId = String(order.outlet?._id || order.outlet);
    const customerId = String(order.customer?._id || order.customer);
    io.to('admin').emit(event, serializeOrder(order, 'admin'));
    io.to(`outlet:${outletId}`).emit(event, serializeOrder(order, 'staff'));
    io.to(`user:${customerId}`).emit(event, serializeOrder(order, 'customer', { settings }));
  } catch (err) {
    logger.error('realtime emit failed', { event, error: err.message });
  }
}

export function emitAdminAlert(message, meta = {}) {
  if (io) io.to('admin').emit('alert', { message, ...meta, at: new Date().toISOString() });
}

export const closeRealtime = () => io?.close();
