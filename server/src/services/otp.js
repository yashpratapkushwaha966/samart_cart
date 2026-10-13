import crypto from 'node:crypto';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// We store only an HMAC of the OTP, so a database leak does not reveal usable codes.
export const hashOtp = (email, otp, pepper) =>
  crypto.createHmac('sha256', pepper).update(`${email.toLowerCase()}:${otp}`).digest('hex');

export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** record: { codeHash, expiresAt, attempts, consumedAt } -> { ok, reason } */
export function checkOtp({ record, email, otp, pepper, now = new Date() }) {
  if (!record || record.consumedAt) return { ok: false, reason: 'NO_CODE' };
  if (new Date(record.expiresAt) <= now) return { ok: false, reason: 'EXPIRED' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  const ok = safeEqualHex(record.codeHash, hashOtp(email, String(otp), pepper));
  return ok ? { ok: true } : { ok: false, reason: 'WRONG_CODE' };
}
