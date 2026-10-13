import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { OtpToken } from '../models/OtpToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { AppError, badRequest, forbidden, unauthorized } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { generateOtp, hashOtp, checkOtp, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from '../services/otp.js';
import { sendOtp } from '../services/otpDelivery.js';
import { createSession, cookieOptions, ensurePin, publicUser, revokeSessionByToken } from '../services/authService.js';
import { audit } from '../services/audit.js';
import { logger } from '../utils/logger.js';

const BAD_CODE = 'That code is invalid or has expired. Please request a new one.';
// A real bcrypt hash of a random string: used so "unknown email" takes as long as "wrong password".
const DUMMY_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5BEnVmWQ7CSDf8q6f9q2yQmQdXk5K';

async function startSession(req, res, user) {
  user.lastLoginAt = new Date();
  ensurePin(user);
  await user.save();
  const { token, ttlMs } = await createSession(user, { ip: req.ip, userAgent: req.get('user-agent') });
  res.cookie('sid', token, cookieOptions(ttlMs));
  audit({ id: user._id, role: user.role }, 'auth.login', 'User', user._id, { via: req.authVia }, req.ip);
  return ok(res, { user: publicUser(user) });
}

export const requestOtp = asyncHandler(async (req, res) => {
  const { email, phone } = req.valid.body;
  const recent = await OtpToken.findOne({ email, consumedAt: null, createdAt: { $gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } });
  if (recent) throw new AppError(429, 'Please wait a minute before asking for another code', 'OTP_COOLDOWN');

  // Staff/admin never use OTP. We answer the same way so nobody can probe which emails exist.
  const existing = await User.findOne({ email }).select('role isActive');
  if (!existing || (existing.role === 'customer' && existing.isActive)) {
    const otp = generateOtp();
    await OtpToken.deleteMany({ email });
    await OtpToken.create({ email, codeHash: hashOtp(email, otp, env.appSecret), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
    try { await sendOtp({ email, phone, otp }); } catch (err) {
      logger.error('otp email failed', { error: err.message });
      throw new AppError(502, 'We could not send the email. Please try again.', 'EMAIL_FAILED');
    }
  }
  return ok(res, { sent: true, expiresInMinutes: OTP_TTL_MS / 60000 });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code, name, phone } = req.valid.body;
  const record = await OtpToken.findOne({ email, consumedAt: null }).sort({ createdAt: -1 });
  const result = checkOtp({ record, email, otp: code, pepper: env.appSecret });
  if (!result.ok) {
    if (record && result.reason === 'WRONG_CODE') await OtpToken.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw badRequest(BAD_CODE, 'OTP_INVALID');
  }
  // Atomic "use once": a second request with the same code finds nothing to consume.
  const consumed = await OtpToken.findOneAndUpdate({ _id: record._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
  if (!consumed) throw badRequest(BAD_CODE, 'OTP_INVALID');

  let user = await User.findOne({ email });
  if (user && (user.role !== 'customer' || !user.isActive)) throw badRequest(BAD_CODE, 'OTP_INVALID');
  if (!user) user = new User({ email, role: 'customer' }); // role is fixed here, never from the request
  user.name = name; user.phone = phone; // full name and contact number are compulsory
  req.authVia = 'otp';
  return startSession(req, res, user);
});

let googleClient;
export const googleLogin = asyncHandler(async (req, res) => {
  if (!env.googleClientId) throw new AppError(503, 'Google sign-in is not set up yet', 'GOOGLE_NOT_CONFIGURED');
  googleClient ||= new OAuth2Client(env.googleClientId);
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: req.valid.body.credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw unauthorized('Google sign-in could not be verified', 'GOOGLE_INVALID');
  }
  if (!payload?.email || !payload.email_verified) throw unauthorized('Your Google email is not verified', 'GOOGLE_UNVERIFIED');

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  if (user && (user.role !== 'customer' || !user.isActive)) throw forbidden('This account cannot sign in here', 'ROLE_NOT_ALLOWED');
  if (!user) user = new User({ email, role: 'customer', name: payload.name?.slice(0, 80) });
  if (!user.googleId) user.googleId = payload.sub;
  if (!user.name && payload.name) user.name = payload.name.slice(0, 80);
  req.authVia = 'google';
  return startSession(req, res, user);
});

// Staff and admin sign in with email + password. Their accounts are created by the owner, never by sign-up.
export const passwordLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email, role: { $in: ['staff', 'admin'] } }).select('+passwordHash');
  const match = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !match || !user.isActive) throw unauthorized('Wrong email or password', 'BAD_CREDENTIALS');
  req.authVia = 'password';
  return startSession(req, res, user);
});

export const logout = asyncHandler(async (req, res) => {
  await revokeSessionByToken(req.cookies?.sid);
  res.clearCookie('sid', { path: '/' });
  return ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  if (req.user && ensurePin(req.user)) await req.user.save(); // customers who joined before PINs existed get theirs here
  return ok(res, { user: req.user ? publicUser(req.user) : null });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.valid.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  return ok(res, { user: publicUser(req.user) });
});
