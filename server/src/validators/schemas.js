import { z } from 'zod';
import { ORDER_STATUS } from '../services/orderStateMachine.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(160);
const name = z.string().trim().min(1).max(80);
const phone = z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number');
const optionalText = (max) => z.string().trim().max(max).optional();
const imageUrl = z.string().trim().regex(/^(\/uploads\/[A-Za-z0-9._-]+|https:\/\/[^\s]+)?$/, 'Image must be an uploaded file or an https link');
const dateOrEmpty = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());

export const idParam = z.object({ id: objectId });

// ---- auth ----
const fullName = z.string().trim().min(2, 'Enter your full name').max(80);
const requiredPhone = z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid contact number');
export const otpRequest = z.object({ email, name: fullName, phone: requiredPhone });
export const otpVerify = z.object({ email, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), name: fullName, phone: requiredPhone });
export const googleLogin = z.object({ credential: z.string().min(20).max(4000) });
export const passwordLogin = z.object({ email, password: z.string().min(1).max(200) });
export const profileUpdate = z.object({ name: fullName.optional(), phone: requiredPhone.optional() });

// ---- orders ----
const orderItems = z
  .array(z.object({ productId: objectId, quantity: z.number().int().min(1).max(20) }))
  .min(1, 'Your cart is empty').max(25);
export const quoteBody = z.object({
  outletSlug: z.string().trim().toLowerCase().min(2).max(40),
  items: orderItems,
  offerCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Invalid offer code').optional().or(z.literal('').transform(() => undefined)),
});
export const createOrderBody = quoteBody.extend({
  serviceType: z.enum(['dine_in', 'takeaway']),
  paymentMethod: z.enum(['cash', 'upi', 'online']),
  instructions: optionalText(200),
  idempotencyKey: z.string().trim().min(8).max(80),
});

// ---- payments ----
export const gatewayCreate = z.object({ orderId: objectId });
export const gatewayVerify = z.object({
  orderId: objectId,
  razorpay_order_id: z.string().min(5).max(80),
  razorpay_payment_id: z.string().min(5).max(80),
  razorpay_signature: z.string().min(10).max(200),
});

// ---- staff & admin order actions ----
export const statusBody = z.object({
  status: z.enum(ORDER_STATUS),
  pin: z.string().trim().regex(/^\d{4}$/, 'PIN is 4 digits').optional(),
  reason: optionalText(120),
});
export const confirmPaymentBody = z.object({ upiReference: optionalText(40) });
export const refundBody = z.object({ note: optionalText(200) });
export const staffOrdersQuery = z.object({
  scope: z.enum(['active', 'completed']).default('active'),
  q: z.string().trim().max(40).optional(),
});
export const adminOrdersQuery = z.object({
  status: z.enum(ORDER_STATUS).optional(),
  paymentStatus: z.enum(['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded']).optional(),
  method: z.enum(['cash', 'upi', 'online']).optional(),
  from: dateOrEmpty, to: dateOrEmpty,
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const reportsQuery = z.object({ range: z.enum(['daily', 'weekly', 'monthly']).default('daily') });
export const auditQuery = z.object({
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// ---- catalog ----
export const productBody = z.object({
  name, description: optionalText(500), pricePaise: z.number().int().min(100).max(1_000_000),
  imageUrl: imageUrl.optional(), category: objectId, isVeg: z.boolean().optional(), isFeatured: z.boolean().optional(),
  isAvailable: z.boolean().optional(), sortOrder: z.number().int().min(0).max(9999).optional(),
});
export const productPatch = productBody.partial();
export const categoryBody = z.object({
  name: z.string().trim().min(1).max(60), sortOrder: z.number().int().min(0).max(9999).optional(), isActive: z.boolean().optional(),
});
export const offerBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Code: 3-20 letters/numbers'),
  title: z.string().trim().min(1).max(80), description: optionalText(200),
  type: z.enum(['percent', 'flat']), value: z.number().int().min(1),
  minOrderPaise: z.number().int().min(0).default(0), maxDiscountPaise: z.number().int().min(0).default(0),
  startsAt: dateOrEmpty, expiresAt: dateOrEmpty,
  usageLimit: z.number().int().min(0).default(0), perUserLimit: z.number().int().min(0).default(1),
  eligibleProductIds: z.array(objectId).default([]),
  showOnHome: z.boolean().default(true), isActive: z.boolean().default(true),
}).refine((o) => o.type !== 'percent' || o.value <= 100, { message: 'Percent cannot exceed 100', path: ['value'] });
export const offerPatch = z.object({ isActive: z.boolean().optional(), showOnHome: z.boolean().optional() });

// ---- team & business ----
export const staffCreate = z.object({
  name, email, phone: phone.optional(),
  password: z.string().min(10, 'Password must be at least 10 characters').max(100),
  outletIds: z.array(objectId).min(1, 'Assign at least one cart'),
});
export const staffPatch = z.object({
  name: name.optional(), isActive: z.boolean().optional(), outletIds: z.array(objectId).min(1).optional(),
  password: z.string().min(10).max(100).optional(),
});
const hours = z.array(z.object({
  day: z.number().int().min(0).max(6), closed: z.boolean().default(false),
  open: z.string().regex(/^\d{2}:\d{2}$/).optional(), close: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})).max(7);
export const outletCreate = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  address: optionalText(200),
});
export const outletPatch = z.object({
  name: z.string().trim().min(2).max(80).optional(), address: optionalText(200),
  openingHours: hours.optional(), isAcceptingOrders: z.boolean().optional(), isActive: z.boolean().optional(),
  upi: z.object({ vpa: z.string().trim().regex(/^[\w.\-]{2,}@[A-Za-z]{2,}$/, 'Enter a valid UPI id like name@bank').or(z.literal('')), payeeName: optionalText(80) }).optional(),
});
export const settingsBody = z.object({
  businessName: z.string().trim().min(1).max(80), tagline: z.string().trim().max(140),
  taxEnabled: z.boolean(), taxPercent: z.number().min(0).max(40), taxLabel: z.string().trim().max(20),
  gstin: z.string().trim().max(20), packagingFeePaise: z.number().int().min(0).max(50_000),
  cancellationWindowMinutes: z.number().int().min(0).max(60),
});

// ---- feedback ----
export const feedbackBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(3, 'Please write a few words').max(1000),
  name: optionalText(80),
});
