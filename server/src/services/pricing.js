import { badRequest } from '../utils/AppError.js';

export const MAX_QTY_PER_ITEM = 20;
export const MAX_DISTINCT_ITEMS = 25;

/**
 * Returns the discount (in paise) if the offer can be used, otherwise throws a clear error.
 * All money is in integer paise. Never floats.
 */
export function evaluateOffer(offer, { lines, subtotalPaise, userOfferUses = 0, now = new Date() }) {
  const fail = (msg) => badRequest(msg, 'OFFER_INVALID');
  if (!offer || !offer.isActive) throw fail('This offer code is not valid');
  if (offer.startsAt && new Date(offer.startsAt) > now) throw fail('This offer has not started yet');
  if (offer.expiresAt && new Date(offer.expiresAt) <= now) throw fail('This offer has expired');
  if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) throw fail('This offer has been fully used');
  if (offer.perUserLimit > 0 && userOfferUses >= offer.perUserLimit) throw fail('You have already used this offer');
  if (subtotalPaise < (offer.minOrderPaise || 0)) {
    throw fail(`Add items worth ₹${Math.ceil((offer.minOrderPaise - subtotalPaise) / 100)} more to use this offer`);
  }

  const eligibleIds = (offer.eligibleProductIds || []).map(String);
  const base = eligibleIds.length
    ? lines.filter((l) => eligibleIds.includes(String(l.productId))).reduce((s, l) => s + l.lineTotalPaise, 0)
    : subtotalPaise;
  if (base <= 0) throw fail('This offer does not apply to the items in your cart');

  let discount;
  if (offer.type === 'percent') {
    discount = Math.floor((base * offer.value) / 100);
    if (offer.maxDiscountPaise > 0) discount = Math.min(discount, offer.maxDiscountPaise);
  } else {
    discount = Math.min(offer.value, base); // flat amount in paise
  }
  return Math.max(0, Math.min(discount, base));
}

/**
 * Builds the bill from TRUSTED data (database products + settings), never from client prices.
 * productsById: Map or object of plain product docs.
 * settings: { taxEnabled, taxPercent, taxLabel, packagingFeePaise }
 */
export function computeBill({ items, productsById, outletId, offer = null, userOfferUses = 0, settings = {}, now = new Date() }) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Your cart is empty', 'EMPTY_CART');

  const merged = new Map();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw badRequest(`Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`, 'BAD_QUANTITY');
    }
    const key = String(it.productId);
    merged.set(key, (merged.get(key) || 0) + qty);
  }
  if (merged.size > MAX_DISTINCT_ITEMS) throw badRequest('Too many different items in one order', 'TOO_MANY_ITEMS');

  const lines = [];
  for (const [productId, quantity] of merged) {
    if (quantity > MAX_QTY_PER_ITEM) throw badRequest(`Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`, 'BAD_QUANTITY');
    const p = productsById.get ? productsById.get(productId) : productsById[productId];
    const blockedHere = (p?.unavailableAtOutlets || []).map(String).includes(String(outletId));
    if (!p || !p.isActive || !p.isAvailable || blockedHere) {
      throw badRequest(`${p?.name || 'An item'} is not available right now`, 'PRODUCT_UNAVAILABLE', { productId });
    }
    lines.push({ productId, name: p.name, pricePaise: p.pricePaise, quantity, lineTotalPaise: p.pricePaise * quantity });
  }

  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  let discountPaise = 0;
  let offerCode = null;
  if (offer) {
    discountPaise = evaluateOffer(offer, { lines, subtotalPaise, userOfferUses, now });
    offerCode = offer.code;
  }

  const feePaise = Math.max(0, settings.packagingFeePaise || 0);
  const taxable = subtotalPaise - discountPaise + feePaise;
  // Tax is OFF by default. When on, it is added on top of prices (prices are treated as tax-exclusive).
  // Ask your accountant which rate/rules apply to your business before enabling it.
  const taxPaise = settings.taxEnabled ? Math.round((taxable * (settings.taxPercent || 0)) / 100) : 0;
  const totalPaise = taxable + taxPaise;

  return {
    lines, subtotalPaise, discountPaise, offerCode, feePaise, taxPaise, totalPaise,
    taxLabel: settings.taxEnabled ? settings.taxLabel || 'Tax' : null,
  };
}
