import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { orderLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import * as c from '../controllers/order.controller.js';

const r = Router();
r.post('/quote', validate({ body: s.quoteBody }), c.quote); // price check, saves nothing
r.use(requireRole('customer')); // everything below: logged-in customers, own data only
r.post('/', orderLimiter, validate({ body: s.createOrderBody }), c.create);
r.get('/', c.list);
r.get('/:id', validate({ params: s.idParam }), c.getOne);
r.post('/:id/cancel', validate({ params: s.idParam }), c.cancel);
r.get('/:id/upi', validate({ params: s.idParam }), c.upiInfo);
export default r;
