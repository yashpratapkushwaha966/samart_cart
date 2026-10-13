import 'dotenv/config';

const str = (k, d = '') => (process.env[k] ?? d).toString().trim();
const num = (k, d) => { const n = Number(str(k)); return Number.isFinite(n) && n > 0 ? n : d; };
const nodeEnv = str('NODE_ENV', 'development');
const isProd = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: Number(str('PORT', '5000')),
  clientUrl: str('CLIENT_URL', 'http://localhost:5173').replace(/\/$/, ''),
  serveClient: str('SERVE_CLIENT') === 'true',
  trustProxy: Number(str('TRUST_PROXY', '0')),
  mongoUri: str('MONGODB_URI'),
  appSecret: str('APP_SECRET'),
  // How long a login lasts (hours). Change in .env, then restart the server.
  session: { customerHours: num('SESSION_CUSTOMER_HOURS', 720), staffHours: num('SESSION_STAFF_HOURS', 12), adminHours: num('SESSION_ADMIN_HOURS', 8) },
  // How the one-time code is delivered. Only "email" is built today; "sms" is the planned future option.
  otpChannel: str('OTP_CHANNEL', 'email').toLowerCase(),
  // Staff must also type the customer's permanent 4-digit PIN to hand over an order. Set to false to turn this off.
  completeNeedsPin: str('COMPLETE_NEEDS_PIN', 'true') !== 'false',
  smtp: {
    host: str('SMTP_HOST'), port: Number(str('SMTP_PORT', '465')),
    user: str('SMTP_USER'), pass: str('SMTP_PASS'), from: str('MAIL_FROM', 'Smart Momos <no-reply@localhost>'),
  },
  googleClientId: str('GOOGLE_CLIENT_ID'),
  razorpay: {
    keyId: str('RAZORPAY_KEY_ID'), keySecret: str('RAZORPAY_KEY_SECRET'), webhookSecret: str('RAZORPAY_WEBHOOK_SECRET'),
  },
  admin: { name: str('ADMIN_NAME', 'Owner'), email: str('ADMIN_EMAIL').toLowerCase(), password: str('ADMIN_PASSWORD') },
  seedStaff: { email: str('SEED_STAFF_EMAIL').toLowerCase(), password: str('SEED_STAFF_PASSWORD') },
};

export const gatewayConfigured = () => Boolean(env.razorpay.keyId && env.razorpay.keySecret);
export const emailConfigured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

// Fail fast on unsafe configuration instead of running insecurely.
export function assertEnv() {
  const problems = [];
  if (!env.mongoUri) problems.push('MONGODB_URI is missing');
  if (env.appSecret.length < 32) problems.push('APP_SECRET must be at least 32 characters');
  if (env.otpChannel !== 'email') problems.push(`OTP_CHANNEL=${env.otpChannel} is not available yet. Use OTP_CHANNEL=email`);
  if (isProd && !emailConfigured()) problems.push('SMTP settings are required in production (customers log in with email OTP)');
  if (problems.length) throw new Error(`Configuration problem(s):\n - ${problems.join('\n - ')}`);
}
