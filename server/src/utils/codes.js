import crypto from 'node:crypto';
import { IST_OFFSET_MS } from './time.js';

// No I, L, O, 0, 1 so a code is easy to read out loud at the cart.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCouponCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

// Staff may type "ab3-k9z" or "AB3 K9Z". Normalise before comparing.
export const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// SMC-20261010-0007
export function formatOrderNumber(outletCode, date, seq) {
  const ymd = new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '');
  return `${outletCode}-${ymd}-${String(seq).padStart(4, '0')}`;
}
