import crypto from 'node:crypto';
import { Session } from '../models/Session.js';
import { env } from '../config/env.js';

const HOUR = 3600_000;
// Lifetimes come from .env (SESSION_*_HOURS). Customers stay logged in longer than staff/admin.
export const SESSION_TTL_MS = { customer: env.session.customerHours * HOUR, staff: env.session.staffHours * HOUR, admin: env.session.adminHours * HOUR };

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(user, { ip, userAgent } = {}) {
  // One-active-session rule for customers: a new login logs out every older session.
  if (user.role === 'customer') {
    await Session.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const ttlMs = SESSION_TTL_MS[user.role] || 8 * HOUR;
  await Session.create({
    user: user._id, tokenHash: hashToken(token), role: user.role,
    userAgent: userAgent?.slice(0, 300), ip, expiresAt: new Date(Date.now() + ttlMs),
  });
  return { token, ttlMs };
}

export async function resolveSession(token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const session = await Session.findOne({ tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } }).populate('user');
  if (!session?.user || !session.user.isActive) return null;
  return { session, user: session.user };
}

export const revokeSessionByToken = (token) =>
  token ? Session.updateOne({ tokenHash: hashToken(token) }, { $set: { revokedAt: new Date() } }) : null;
export const revokeAllSessionsForUser = (userId) =>
  Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

export const cookieOptions = (ttlMs) => ({ httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: ttlMs, path: '/' });

// One permanent 4-digit PIN per customer. Made the first time it is needed, then never changes.
// Easy patterns (0000, 1234, 4321...) are skipped.
const weakPin = (p) => /^(\d)\1{3}$/.test(p) || '01234567890'.includes(p) || '09876543210'.includes(p);
export function newPin() {
  let p;
  do { p = String(crypto.randomInt(0, 10000)).padStart(4, '0'); } while (weakPin(p));
  return p;
}
/** Gives a customer their PIN if they do not have one yet. Returns true when it created one (caller saves). */
export function ensurePin(user) {
  if (user.role !== 'customer' || user.pin) return false;
  user.pin = newPin();
  return true;
}

export const publicUser = (u) => ({
  id: String(u._id), name: u.name || '', email: u.email, phone: u.phone || '', role: u.role,
  outletIds: (u.outletIds || []).map(String),
  ...(u.role === 'customer' ? { pin: u.pin || null } : {}), // the PIN is only ever shown to its owner
});
