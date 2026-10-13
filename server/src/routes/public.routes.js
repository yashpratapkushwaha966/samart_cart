import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { feedbackLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import { defaultOutlet, getMenu } from '../controllers/menu.controller.js';
import { createFeedback } from '../controllers/feedback.controller.js';

const r = Router();
r.get('/outlets/default', defaultOutlet);
r.get('/outlets/:slug/menu', getMenu);
r.post('/feedback', feedbackLimiter, validate({ body: s.feedbackBody }), createFeedback);
export default r;
