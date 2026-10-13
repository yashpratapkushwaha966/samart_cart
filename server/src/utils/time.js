// India has no daylight saving, so IST is always UTC+5:30. All "today / this week" logic uses IST.
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function startOfDayIST(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

// "2026-10-10" in IST
export function dayKeyIST(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * openingHours: [{ day: 0-6 (0 = Sunday), closed: bool, open: "10:00", close: "22:00" }]
 * No hours configured at all => treated as "always open" (admin can still pause the cart).
 */
export function isOpenNow(openingHours, now = new Date()) {
  if (!Array.isArray(openingHours) || openingHours.length === 0) return true;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const today = openingHours.find((h) => h.day === day);
  if (!today || today.closed) return false;
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (open < close) return minutes >= open && minutes < close;
  return minutes >= open || minutes < close; // closes after midnight
}

// Monday 00:00 IST of the week containing `date`
export function startOfWeekIST(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const sinceMonday = (ist.getUTCDay() + 6) % 7;
  return startOfDayIST(addDays(date, -sinceMonday));
}

// 1st of the month 00:00 IST
export function startOfMonthIST(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}
