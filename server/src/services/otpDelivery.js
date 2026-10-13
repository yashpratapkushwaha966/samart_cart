import { env } from '../config/env.js';
import { sendOtpEmail } from './mailer.js';

// ONE place decides how the code reaches the customer (OTP_CHANNEL in .env).
// To add SMS later: write sendOtpSms({ phone, otp }) and add `case 'sms'` below. Nothing else needs to change.
export async function sendOtp({ email, phone, otp }) {
  switch (env.otpChannel) {
    case 'email': return sendOtpEmail(email, otp);
    default: throw new Error(`OTP channel "${env.otpChannel}" is not available`);
  }
}
