# API reference (`/api/v1`)

- Success: `{ "success": true, "data": { ... } }`
- Error: `{ "success": false, "error": { "code": "INVALID_TRANSITION", "message": "…", "details": [...] } }`
- Auth: cookie `sid` (set by login). Every `POST/PATCH/PUT/DELETE` from the browser must send header `X-Requested-With: XMLHttpRequest`.
- Money: integer **paise**. Dates: ISO strings.
- Common codes: 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`/`ROLE_NOT_ALLOWED`, 404 `NOT_FOUND`, 409 `INVALID_TRANSITION`/`STATUS_CONFLICT`/`PAYMENT_NOT_CONFIRMED`, 429 `RATE_LIMITED`.

## Public
| Method & path | Notes |
|---|---|
| `GET /public/outlets/default` | `{ slug }` of the first active cart |
| `GET /public/outlets/:slug/menu` | `{ outlet{ name, isOpen, paymentMethods[] }, business, categories[], products[], offers[] }` |

## Auth
| Method & path | Body → result |
|---|---|
| `POST /auth/otp/request` | `{ email, name, phone }` (name + phone compulsory) → `{ sent: true }` (same answer for unknown emails) |
| `POST /auth/otp/verify` | `{ email, code, name, phone }` → `{ user }` + cookie. Creates a **customer** if new |
| `POST /auth/google` | `{ credential }` (Google ID token) → `{ user }` |
| `POST /auth/login` | `{ email, password }` staff/admin only → `{ user }` |
| `POST /auth/logout` | clears the session |
| `GET /auth/me` | `{ user }` or `{ user: null }` |
| `PATCH /auth/me` | `{ name?, phone? }` |

## Customer (role `customer`)
| Method & path | Notes |
|---|---|
| `POST /orders/quote` | `{ outletSlug, items:[{productId, quantity}], offerCode? }` → `{ bill, isOpen, paymentMethods }`. Saves nothing. Public |
| `POST /orders` | quote body + `{ serviceType: dine_in\|takeaway, paymentMethod: cash\|upi\|online, instructions?, idempotencyKey }` → `201 { order, existing }`. Same key again returns the same order (`200`) |
| `GET /orders` | my orders (latest 50) |
| `GET /orders/:id` | one of **my** orders, else `404`. Includes `permissions.canCancel` |
| `POST /orders/:id/cancel` | only while Placed, unpaid, inside the window |
| `GET /orders/:id/upi` | `{ uri, qrDataUrl, vpa, payeeName, amountPaise, paymentStatus }` |
| `POST /payments/online/create` | `{ orderId }` → `{ keyId, gatewayOrderId, amountPaise, currency }` |
| `POST /payments/online/verify` | `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` → `{ order }` (signature checked server-side) |

Example order response (customer view):
```json
{ "order": { "id": "…", "orderNumber": "SMC-20261011-0007",
  "status": "Placed", "paymentStatus": "Pending", "paymentMethod": "cash",
  "items": [{ "productId": "…", "name": "Veg Momos", "pricePaise": 6000, "quantity": 2, "lineTotalPaise": 12000 }],
  "subtotalPaise": 12000, "discountPaise": 0, "feePaise": 0, "taxPaise": 0, "totalPaise": 12000,
  "permissions": { "canCancel": true } } }
```

## Gateway webhook
`POST /payments/webhook/razorpay` (public, **signed**: header `X-Razorpay-Signature`, raw body). Returns `200` after a valid signature, `400` on a bad one. Duplicate event ids are ignored.

## Staff (role `staff`, own carts only)
| Method & path | Notes |
|---|---|
| `GET /staff/outlets` | my carts |
| `GET /staff/orders?scope=active\|completed&q=` | queue; `q` searches order number or collection code (all history) |
| `PATCH /staff/orders/:id/status` | `{ status, pin?, reason? }`. `Completed` needs the customer's 4-digit `pin` (staff) and payment `Paid` |
| `POST /staff/orders/:id/confirm-payment` | `{ upiReference? }` for cash/UPI. Safe to repeat |

## Admin (role `admin`)
| Method & path | Notes |
|---|---|
| `GET /admin/dashboard` | counts, sales today/week/month by method, last 7 days, popular, recent |
| `GET /admin/reports?range=daily\|weekly\|monthly` | `{ series[], totals, refundedPaise }` |
| `GET /admin/orders?status&paymentStatus&method&from&to&q&page&limit` | filtered list |
| `GET /admin/orders/:id` | full detail + payment record |
| `PATCH /admin/orders/:id/status` · `POST …/confirm-payment` · `POST …/refund` | `{ note? }` records a refund that you paid |
| `GET/POST /admin/products`, `PATCH/DELETE /admin/products/:id` | `{ name, description, pricePaise, imageUrl, category, isVeg, isFeatured, isAvailable }` |
| `POST /admin/uploads` | multipart field `image` (jpg/png/webp ≤ 2 MB) → `{ url }` |
| `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id` | |
| `GET/POST /admin/offers`, `PUT/PATCH/DELETE /admin/offers/:id` | |
| `GET /admin/customers?q=` | name, email, phone, orders, paid total |
| `GET/POST /admin/staff`, `PATCH/DELETE /admin/staff/:id` | create with password + `outletIds` |
| `GET/POST /admin/outlets`, `PATCH /admin/outlets/:id`, `GET /admin/outlets/:id/qr` | QR returns `{ url, png, svg }` |
| `GET/PUT /admin/settings` | tax, packaging fee, cancellation window |
| `GET /admin/audit?action&page` | activity log |

## Real-time (Socket.io, same host, cookie-authenticated)
Events: `order:new`, `order:updated` (payload = the order in the receiver's allowed shape), `alert` (admin only). Customers join `user:<id>`, staff `outlet:<id>`, admin `admin`.

## Feedback and PIN (added later)

| Endpoint | Who | Notes |
|---|---|---|
| `POST /public/feedback` | anyone | `{ rating 1-5, message, name? }`, 5 per hour per IP |
| `GET /admin/feedback` | admin | list + average rating |
| `DELETE /admin/feedback/:id` | admin | |
| `PATCH /staff/orders/:id/status` | staff | completing now also needs `pin` (the customer's 4-digit PIN) unless `COMPLETE_NEEDS_PIN=false` |

`GET /auth/me` returns `pin` for customers only. The PIN is created once and never changes.
