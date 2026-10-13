import { Outlet } from '../models/Outlet.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Offer } from '../models/Offer.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { notFound } from '../utils/AppError.js';
import { isOpenNow } from '../utils/time.js';
import { getSettings } from '../services/settings.js';
import { availablePaymentMethods } from '../services/orderService.js';

export const defaultOutlet = asyncHandler(async (req, res) => {
  const outlet = await Outlet.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  if (!outlet) throw notFound('No cart has been set up yet');
  return ok(res, { slug: outlet.slug });
});

// Everything the customer app needs to show one cart's menu. Public, but contains no private data.
export const getMenu = asyncHandler(async (req, res) => {
  const outlet = await Outlet.findOne({ slug: req.params.slug.toLowerCase(), isActive: true }).lean();
  if (!outlet) throw notFound('This cart was not found', 'OUTLET_NOT_FOUND');
  const now = new Date();
  const [settings, categories, products, offers] = await Promise.all([
    getSettings(),
    Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Offer.find({
      isActive: true, showOnHome: true,
      $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
    }).lean(),
  ]);

  return ok(res, {
    outlet: {
      id: String(outlet._id), name: outlet.name, slug: outlet.slug, address: outlet.address || '',
      isOpen: outlet.isAcceptingOrders && isOpenNow(outlet.openingHours, now),
      openingHours: outlet.openingHours || [], paymentMethods: availablePaymentMethods(outlet), upiComingSoon: !outlet.upi?.vpa,
    },
    business: {
      name: settings.businessName, tagline: settings.tagline, taxEnabled: settings.taxEnabled,
      taxPercent: settings.taxPercent, taxLabel: settings.taxLabel, gstin: settings.gstin, packagingFeePaise: settings.packagingFeePaise,
    },
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug })),
    products: products.map((p) => ({
      id: String(p._id), name: p.name, description: p.description, pricePaise: p.pricePaise, imageUrl: p.imageUrl,
      categoryId: String(p.category), isVeg: p.isVeg, isFeatured: p.isFeatured,
      isAvailable: p.isAvailable && !(p.unavailableAtOutlets || []).map(String).includes(String(outlet._id)),
    })),
    offers: offers
      .filter((o) => !(o.usageLimit > 0 && o.usedCount >= o.usageLimit))
      .map((o) => ({ code: o.code, title: o.title, description: o.description, type: o.type, value: o.value, minOrderPaise: o.minOrderPaise, maxDiscountPaise: o.maxDiscountPaise, expiresAt: o.expiresAt })),
  });
});
