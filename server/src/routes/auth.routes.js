import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { otpRequestLimiter, otpVerifyLimiter, passwordLoginLimiter, googleLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import * as c from '../controllers/auth.controller.js';

const r = Router();
r.post('/otp/request', otpRequestLimiter, validate({ body: s.otpRequest }), c.requestOtp);
r.post('/otp/verify', otpVerifyLimiter, validate({ body: s.otpVerify }), c.verifyOtp);
r.post('/google', googleLimiter, validate({ body: s.googleLogin }), c.googleLogin);
r.post('/login', passwordLoginLimiter, validate({ body: s.passwordLogin }), c.passwordLogin); // staff + admin
r.post('/logout', c.logout);
r.get('/me', c.me);
r.patch('/me', requireAuth, validate({ body: s.profileUpdate }), c.updateMe);
export default r;
