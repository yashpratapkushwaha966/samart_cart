import nodemailer from 'nodemailer';
import { env, emailConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transport;
const getTransport = () => {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transport;
};

// Integration tests read the code from here instead of an inbox. Only filled when NODE_ENV=test.
export const testOutbox = new Map();

export async function sendOtpEmail(email, otp) {
  if (env.isTest) { testOutbox.set(email, otp); return; }
  if (!emailConfigured()) {
    if (env.isProd) throw new Error('SMTP is not configured');
    // Development convenience ONLY: no SMTP set up, so print the code to the server terminal.
    logger.warn('DEV ONLY: SMTP not configured, OTP printed here instead of emailed', { email, otp });
    return;
  }
  await getTransport().sendMail({
    from: env.smtp.from, to: email,
    subject: `Your Smart Momos login code: ${otp}`,
    text: `Your login code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif"><h2>Smart Momos</h2><p>Your login code is</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${otp}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p></div>`,
  });
}
