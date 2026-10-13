import { Router } from 'express';
import { attachUser, requireAuth } from '../middleware/auth.js';
import authRoutes from './auth.routes.js';
import publicRoutes from './public.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import staffRoutes from './staff.routes.js';
import adminRoutes from './admin.routes.js';

const r = Router();
r.use(attachUser);
r.use('/public', publicRoutes);
r.use('/auth', authRoutes);
r.use('/orders', orderRoutes);
r.use('/payments', requireAuth, paymentRoutes);
r.use('/staff', staffRoutes);
r.use('/admin', adminRoutes);
export default r;
