import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { User } from '../models/User.js';
import { Outlet } from '../models/Outlet.js';
import { Setting } from '../models/Setting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { badRequest, notFound } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { audit } from '../services/audit.js';
import { actorOf } from '../services/orderAccess.js';
import { revokeAllSessionsForUser } from '../services/authService.js';
import { getSettings } from '../services/settings.js';

const asStaff = (u) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', isActive: u.isActive, outletIds: (u.outletIds || []).map(String), lastLoginAt: u.lastLoginAt });
const asOutlet = (o) => ({
  id: String(o._id), name: o.name, code: o.code, slug: o.slug, address: o.address || '', openingHours: o.openingHours || [],
  isAcceptingOrders: o.isAcceptingOrders, isActive: o.isActive, upi: { vpa: o.upi?.vpa || '', payeeName: o.upi?.payeeName || '' },
  menuUrl: `${env.clientUrl}/c/${o.slug}`,
});
async function assertOutletsExist(ids) {
  const found = await Outlet.countDocuments({ _id: { $in: ids } });
  if (found !== new Set(ids).size) throw badRequest('One of the selected carts does not exist', 'BAD_OUTLET');
}

// ---------- staff ----------
// Staff accounts are created ONLY here, by a logged-in admin. Public sign-up can never create staff or admin.
export const listStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ createdAt: -1 }).lean();
  return ok(res, { staff: staff.map(asStaff) });
});

export const createStaff = asyncHandler(async (req, res) => {
  const { name, email, phone, password, outletIds } = req.valid.body;
  await assertOutletsExist(outletIds);
  const u = await User.create({ name, email, phone, role: 'staff', outletIds, passwordHash: await bcrypt.hash(password, 12) });
  audit(actorOf(req.user), 'staff.create', 'User', u._id, { email }, req.ip);
  return ok(res, { staff: asStaff(u) }, 201);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.valid.body;
  if (rest.outletIds) await assertOutletsExist(rest.outletIds);
  const set = { ...rest };
  if (password) set.passwordHash = await bcrypt.hash(password, 12);
  const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'staff' }, { $set: set }, { new: true });
  if (!u) throw notFound('Staff member not found');
  if (password || rest.isActive === false || rest.outletIds) await revokeAllSessionsForUser(u._id); // force a fresh login
  audit(actorOf(req.user), 'staff.update', 'User', u._id, { email: u.email, passwordReset: Boolean(password), isActive: u.isActive }, req.ip);
  return ok(res, { staff: asStaff(u) });
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const u = await User.findOneAndDelete({ _id: req.params.id, role: 'staff' });
  if (!u) throw notFound('Staff member not found');
  await revokeAllSessionsForUser(u._id);
  audit(actorOf(req.user), 'staff.delete', 'User', u._id, { email: u.email }, req.ip);
  return ok(res, { deleted: true });
});

// ---------- carts (outlets) ----------
export const listOutlets = asyncHandler(async (req, res) => {
  const outlets = await Outlet.find().sort({ createdAt: 1 }).lean();
  return ok(res, { outlets: outlets.map(asOutlet) });
});

export const createOutlet = asyncHandler(async (req, res) => {
  const o = await Outlet.create(req.valid.body);
  audit(actorOf(req.user), 'outlet.create', 'Outlet', o._id, { name: o.name }, req.ip);
  return ok(res, { outlet: asOutlet(o) }, 201);
});

export const updateOutlet = asyncHandler(async (req, res) => {
  const o = await Outlet.findByIdAndUpdate(req.params.id, { $set: req.valid.body }, { new: true, runValidators: true });
  if (!o) throw notFound('Cart not found');
  audit(actorOf(req.user), 'outlet.update', 'Outlet', o._id, { fields: Object.keys(req.valid.body) }, req.ip);
  return ok(res, { outlet: asOutlet(o) });
});

// The printed QR for a cart. It opens THIS cart's menu in any phone browser. No app needed.
export const outletQr = asyncHandler(async (req, res) => {
  const o = await Outlet.findById(req.params.id).lean();
  if (!o) throw notFound('Cart not found');
  const url = `${env.clientUrl}/c/${o.slug}`;
  const [png, svg] = await Promise.all([
    QRCode.toDataURL(url, { margin: 2, width: 800, errorCorrectionLevel: 'H' }),
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'H' }),
  ]);
  return ok(res, { url, png, svg, name: o.name });
});

// ---------- business settings ----------
export const getBusinessSettings = asyncHandler(async (req, res) => {
  const s = await getSettings();
  return ok(res, { settings: { ...s, _id: undefined, __v: undefined, key: undefined } });
});

export const saveBusinessSettings = asyncHandler(async (req, res) => {
  const s = await Setting.findOneAndUpdate({ key: 'business' }, { $set: req.valid.body }, { upsert: true, new: true, runValidators: true }).lean();
  audit(actorOf(req.user), 'settings.update', 'Setting', 'business', { taxEnabled: s.taxEnabled, taxPercent: s.taxPercent }, req.ip);
  return ok(res, { settings: { ...s, _id: undefined, __v: undefined, key: undefined } });
});
