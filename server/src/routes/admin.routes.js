import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import * as s from '../validators/schemas.js';
import * as a from '../controllers/admin.controller.js';
import * as cat from '../controllers/adminCatalog.controller.js';
import * as t from '../controllers/adminTeam.controller.js';
import * as fb from '../controllers/feedback.controller.js';

const r = Router();
r.use(requireRole('admin'));
const id = { params: s.idParam };

r.get('/dashboard', a.dashboard);
r.get('/reports', validate({ query: s.reportsQuery }), a.reports);
r.get('/audit', validate({ query: s.auditQuery }), a.listAudit);
r.get('/customers', a.listCustomers);
r.get('/feedback', fb.listFeedback);
r.delete('/feedback/:id', validate(id), fb.deleteFeedback);

r.get('/orders', validate({ query: s.adminOrdersQuery }), a.listOrders);
r.get('/orders/:id', validate(id), a.getOrder);
r.patch('/orders/:id/status', validate({ ...id, body: s.statusBody }), a.updateOrderStatus);
r.post('/orders/:id/confirm-payment', validate({ ...id, body: s.confirmPaymentBody }), a.confirmOrderPayment);
r.post('/orders/:id/refund', validate({ ...id, body: s.refundBody }), a.refundOrder);

r.get('/products', cat.listProducts);
r.post('/products', validate({ body: s.productBody }), cat.createProduct);
r.patch('/products/:id', validate({ ...id, body: s.productPatch }), cat.updateProduct);
r.delete('/products/:id', validate(id), cat.deleteProduct);
r.post('/uploads', cat.uploadMiddleware, cat.uploadImage);

r.get('/categories', cat.listCategories);
r.post('/categories', validate({ body: s.categoryBody }), cat.createCategory);
r.patch('/categories/:id', validate({ ...id, body: s.categoryBody.partial() }), cat.updateCategory);
r.delete('/categories/:id', validate(id), cat.deleteCategory);

r.get('/offers', cat.listOffers);
r.post('/offers', validate({ body: s.offerBody }), cat.createOffer);
r.put('/offers/:id', validate({ ...id, body: s.offerBody }), cat.updateOffer);
r.patch('/offers/:id', validate({ ...id, body: s.offerPatch }), cat.toggleOffer);
r.delete('/offers/:id', validate(id), cat.deleteOffer);

r.get('/staff', t.listStaff);
r.post('/staff', validate({ body: s.staffCreate }), t.createStaff);
r.patch('/staff/:id', validate({ ...id, body: s.staffPatch }), t.updateStaff);
r.delete('/staff/:id', validate(id), t.deleteStaff);

r.get('/outlets', t.listOutlets);
r.post('/outlets', validate({ body: s.outletCreate }), t.createOutlet);
r.patch('/outlets/:id', validate({ ...id, body: s.outletPatch }), t.updateOutlet);
r.get('/outlets/:id/qr', validate(id), t.outletQr);

r.get('/settings', t.getBusinessSettings);
r.put('/settings', validate({ body: s.settingsBody }), t.saveBusinessSettings);
export default r;
