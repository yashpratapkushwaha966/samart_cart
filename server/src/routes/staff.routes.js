import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import * as s from '../validators/schemas.js';
import * as c from '../controllers/staff.controller.js';

const r = Router();
r.use(requireRole('staff'));
r.get('/outlets', c.myOutlets);
r.get('/orders', validate({ query: s.staffOrdersQuery }), c.listOrders);
r.patch('/orders/:id/status', validate({ params: s.idParam, body: s.statusBody }), c.updateStatus);
r.post('/orders/:id/confirm-payment', validate({ params: s.idParam, body: s.confirmPaymentBody }), c.confirmPayment);
export default r;
