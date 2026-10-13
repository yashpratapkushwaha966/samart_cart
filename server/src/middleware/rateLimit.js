import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message, keyGenerator) =>
  rateLimit({
    windowMs, limit, standardHeaders: true, legacyHeaders: false,
    skip: () => env.isTest,
    keyGenerator,
    handler: (req, res) =>
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }),
  });

const byIpAndEmail = (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase().slice(0, 160)}`;

export const apiLimiter = make(15 * 60_000, 600, 'Too many requests. Please slow down.');
export const otpRequestLimiter = make(15 * 60_000, 5, 'Too many code requests. Try again in a few minutes.', byIpAndEmail);
export const otpVerifyLimiter = make(15 * 60_000, 15, 'Too many attempts. Try again in a few minutes.', byIpAndEmail);
export const passwordLoginLimiter = make(15 * 60_000, 10, 'Too many login attempts. Try again in a few minutes.', byIpAndEmail);
export const googleLimiter = make(15 * 60_000, 20, 'Too many attempts. Try again in a few minutes.');
export const feedbackLimiter = make(60 * 60_000, 5, 'You have sent a lot of feedback. Please try again later.');
export const orderLimiter = make(10 * 60_000, 20, 'Too many order attempts. Please wait a moment.');
