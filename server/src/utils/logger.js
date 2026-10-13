// Small structured logger. Never log OTPs, passwords, tokens or payment secrets.
const line = (level, msg, meta) =>
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta || {}) })
  );
export const logger = {
  info: (m, meta) => line('info', m, meta),
  warn: (m, meta) => line('warn', m, meta),
  error: (m, meta) => line('error', m, meta),
};
