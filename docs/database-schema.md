# Database schema (MongoDB / Mongoose)

All money is stored as integer **paise** (₹60 = 6000).

| Collection | Purpose | Key fields | Indexes |
|---|---|---|---|
| `users` | customers, staff, admin | email, name, phone, `role`, passwordHash (staff/admin only, hidden by default), googleId, outletIds, isActive | `email` unique, `googleId` unique sparse, `role` |
| `outlets` | one physical cart | name, `code`, `slug`, address, openingHours[], isAcceptingOrders, upi{vpa,payeeName} | `code` unique, `slug` unique |
| `categories` | menu groups | name, slug, sortOrder, isActive | `slug` unique |
| `products` | menu items | name, description, `pricePaise`, imageUrl, category→, isVeg, isFeatured, isAvailable, unavailableAtOutlets[] | `category` |
| `offers` | discount codes | `code`, type (percent/flat), value, minOrderPaise, maxDiscountPaise, startsAt, expiresAt, usageLimit, usedCount, perUserLimit, eligibleProductIds[] | `code` unique |
| `orders` | the order | `orderNumber`, `couponCode` (internal only, never shown), customer→, customerName (first name snapshot), outlet→, items[] (**name and price copied at checkout**), totals, paymentMethod, paymentStatus (mirror), payment→, `status`, statusHistory[], idempotencyKey | `orderNumber` unique, `couponCode` unique, `{customer, idempotencyKey}` unique partial, `{outlet,status,createdAt}`, `{customer,createdAt}` |
| `payments` | one per order | order→ (unique), method, amountPaise, `status`, gatewayOrderId, gatewayPaymentId, duplicatePaymentIds[], upiReference, confirmedBy, confirmedAt, refundedAt | `order` unique, `gatewayOrderId` unique sparse, `gatewayPaymentId` unique sparse, `{status,confirmedAt}` |
| `sessions` | logins | user→, tokenHash, role, expiresAt, revokedAt | `tokenHash` unique, TTL on `expiresAt` |
| `otptokens` | email codes | email, codeHash, attempts, consumedAt, expiresAt | TTL on `expiresAt` |
| `webhookevents` | processed gateway events | eventId | `eventId` unique, 90-day TTL |
| `auditlogs` | who did what | actor→, actorRole, action, entityType, entityId, meta, ip | `action`, `createdAt` |
| `settings` | one document `key=business` | businessName, tagline, taxEnabled, taxPercent, taxLabel, gstin, packagingFeePaise, cancellationWindowMinutes | `key` unique |
| `counters` | atomic numbers | `_id` = `order:<CODE>:<YYYY-MM-DD>`, seq | `_id` |

Why separate `payments`? Order status (kitchen) and payment status (money) change independently and have different rules; reports use `payments.status = Paid`.
