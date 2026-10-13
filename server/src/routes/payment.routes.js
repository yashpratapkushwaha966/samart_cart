import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { orderLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import * as c from '../controllers/payment.controller.js';

// The Razorpay webhook is mounted separately in app.js (it needs the raw request body).
const r = Router();
r.use(requireRole('customer'));
r.post('/online/create', orderLimiter, validate({ body: s.gatewayCreate }), c.createOnline);
r.post('/online/verify', orderLimiter, validate({ body: s.gatewayVerify }), c.verifyOnline);
export default r;
