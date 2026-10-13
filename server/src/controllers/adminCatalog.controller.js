import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Offer } from '../models/Offer.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { audit } from '../services/audit.js';
import { actorOf } from '../services/orderAccess.js';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
const asProduct = (p) => ({
  id: String(p._id), name: p.name, description: p.description, pricePaise: p.pricePaise, imageUrl: p.imageUrl,
  category: String(p.category?._id || p.category), categoryName: p.category?.name, isVeg: p.isVeg, isFeatured: p.isFeatured,
  isAvailable: p.isAvailable, sortOrder: p.sortOrder,
});
const asOffer = (o) => ({ ...o, id: String(o._id), _id: undefined, __v: undefined, eligibleProductIds: (o.eligibleProductIds || []).map(String) });

// ---------- products ----------
export const listProducts = asyncHandler(async (req, res) => {
  const products = await Product.find().sort({ sortOrder: 1, name: 1 }).populate('category', 'name').lean();
  return ok(res, { products: products.map(asProduct) });
});

export const createProduct = asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.valid.body.category }))) throw badRequest('Choose a valid category', 'BAD_CATEGORY');
  const p = await Product.create(req.valid.body);
  audit(actorOf(req.user), 'product.create', 'Product', p._id, { name: p.name, pricePaise: p.pricePaise }, req.ip);
  return ok(res, { product: asProduct(p) }, 201);
});

export const updateProduct = asyncHandler(async (req, res) => {
  if (req.valid.body.category && !(await Category.exists({ _id: req.valid.body.category }))) throw badRequest('Choose a valid category', 'BAD_CATEGORY');
  const before = await Product.findById(req.params.id).lean();
  if (!before) throw notFound('Product not found');
  const p = await Product.findByIdAndUpdate(req.params.id, { $set: req.valid.body }, { new: true, runValidators: true });
  const meta = { name: p.name };
  if (req.valid.body.pricePaise !== undefined && before.pricePaise !== p.pricePaise) Object.assign(meta, { priceFrom: before.pricePaise, priceTo: p.pricePaise });
  if (req.valid.body.isAvailable !== undefined && before.isAvailable !== p.isAvailable) meta.isAvailable = p.isAvailable;
  audit(actorOf(req.user), 'product.update', 'Product', p._id, meta, req.ip);
  return ok(res, { product: asProduct(p) });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const p = await Product.findByIdAndDelete(req.params.id);
  if (!p) throw notFound('Product not found');
  await Offer.updateMany({}, { $pull: { eligibleProductIds: p._id } });
  audit(actorOf(req.user), 'product.delete', 'Product', p._id, { name: p.name }, req.ip); // old orders keep their own copy of name/price
  return ok(res, { deleted: true });
});

// ---------- categories ----------
export const listCategories = asyncHandler(async (req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
    Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const byCat = new Map(counts.map((c) => [String(c._id), c.n]));
  return ok(res, { categories: cats.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive, products: byCat.get(String(c._id)) || 0 })) });
});

export const createCategory = asyncHandler(async (req, res) => {
  const base = slugify(req.valid.body.name);
  const slug = (await Category.exists({ slug: base })) ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base;
  const c = await Category.create({ ...req.valid.body, slug });
  audit(actorOf(req.user), 'category.create', 'Category', c._id, { name: c.name }, req.ip);
  return ok(res, { category: { id: String(c._id), name: c.name, slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive, products: 0 } }, 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, { $set: req.valid.body }, { new: true, runValidators: true });
  if (!c) throw notFound('Category not found');
  audit(actorOf(req.user), 'category.update', 'Category', c._id, { name: c.name }, req.ip);
  return ok(res, { category: { id: String(c._id), name: c.name, slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive } });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) throw conflict('Move or delete this category\'s products first', 'CATEGORY_NOT_EMPTY');
  const c = await Category.findByIdAndDelete(req.params.id);
  if (!c) throw notFound('Category not found');
  audit(actorOf(req.user), 'category.delete', 'Category', c._id, { name: c.name }, req.ip);
  return ok(res, { deleted: true });
});

// ---------- offers ----------
export const listOffers = asyncHandler(async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 }).lean();
  return ok(res, { offers: offers.map(asOffer) });
});

export const createOffer = asyncHandler(async (req, res) => {
  const o = await Offer.create(req.valid.body);
  audit(actorOf(req.user), 'offer.create', 'Offer', o._id, { code: o.code }, req.ip);
  return ok(res, { offer: asOffer(o.toObject()) }, 201);
});

export const updateOffer = asyncHandler(async (req, res) => {
  const { code, ...rest } = req.valid.body; // the code of an existing offer is not changed (usage history depends on it)
  const o = await Offer.findByIdAndUpdate(req.params.id, { $set: { ...rest, startsAt: rest.startsAt ?? null, expiresAt: rest.expiresAt ?? null } }, { new: true, runValidators: true }).lean();
  if (!o) throw notFound('Offer not found');
  audit(actorOf(req.user), 'offer.update', 'Offer', o._id, { code: o.code }, req.ip);
  return ok(res, { offer: asOffer(o) });
});

export const toggleOffer = asyncHandler(async (req, res) => {
  const o = await Offer.findByIdAndUpdate(req.params.id, { $set: req.valid.body }, { new: true }).lean();
  if (!o) throw notFound('Offer not found');
  audit(actorOf(req.user), 'offer.toggle', 'Offer', o._id, { code: o.code, ...req.valid.body }, req.ip);
  return ok(res, { offer: asOffer(o) });
});

export const deleteOffer = asyncHandler(async (req, res) => {
  const o = await Offer.findByIdAndDelete(req.params.id);
  if (!o) throw notFound('Offer not found');
  audit(actorOf(req.user), 'offer.delete', 'Offer', o._id, { code: o.code }, req.ip);
  return ok(res, { deleted: true });
});

// ---------- image upload ----------
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${EXT[file.mimetype]}`), // we choose the name and extension
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG or WebP images are allowed', 'BAD_FILE_TYPE'))),
}).single('image');

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Choose an image to upload', 'NO_FILE');
  audit(actorOf(req.user), 'upload.image', 'File', req.file.filename, { size: req.file.size }, req.ip);
  return ok(res, { url: `/uploads/${req.file.filename}` }, 201);
});
