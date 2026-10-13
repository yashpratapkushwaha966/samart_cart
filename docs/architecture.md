# Architecture

```
 Customer phone ──┐                     ┌── MongoDB Atlas (one database)
 Staff phone ─────┼──► Express API ─────┤
 Admin laptop ────┘   /api/v1 + Socket.io└── Razorpay (create order, webhook)
        ▲                    │
        └── live events ◄────┘   (each person only receives what they may see)
```
The three panels are three route groups of **one React app** that talk to **one API**. There is no second order system.

## Order lifecycle (one rule book: `server/src/services/orderStateMachine.js`)
```
Placed ──► Accepted ──► Preparing ──► Ready ──► Completed
   │           │
   └──► Cancelled ◄┘      (Completed and Cancelled are final)
```
| Move | Who |
|---|---|
| Placed → Accepted, Accepted → Preparing, Preparing → Ready, Ready → Completed | staff of that cart, admin |
| Placed → Cancelled | customer (own order, within the window, unpaid), staff, admin |
| Accepted → Cancelled | staff, admin |

Extra conditions: **Completed** needs payment `Paid`, and staff must type the customer's collection code. Anything else returns `409 INVALID_TRANSITION`.

**Payment status is separate**: `Pending → Paid | Failed | Cancelled`, `Paid → Refunded`.

## How the pieces connect (the "customer orders 2 plates" story)
1. Customer scans the QR → `/c/<slug>` → menu of *that* cart.
2. Checkout calls `POST /orders/quote`, then `POST /orders`. The **server** re-reads prices from the database, applies the offer, adds fee/tax, and saves item prices into the order.
3. The server creates the order number (`SMC-20261011-0007`, atomic counter per cart per day) and a 6-character collection code (unique index + retry).
4. Socket.io tells the cart's staff and the admin (`order:new`). Staff sees it with a beep and vibration.
5. Staff taps Accept / Start preparing / Mark ready: `PATCH /staff/orders/:id/status`. Each change is one atomic database update (`findOneAndUpdate` with the expected current status) so two taps or two people cannot apply a stale change. The customer's tracking screen and the admin dashboard update live (and poll every 10-30 s as a fallback).
6. Cash/UPI: staff confirms the money (`confirm-payment`). Online: the server creates a Razorpay order, verifies the signature, and the webhook confirms again.
7. Staff enters the code → Completed. The dashboard and reports are built from `Payment` records with status `Paid`, not from order counts.

## Security measures
- Server-side authority: prices, totals, offers, roles and status rules are never taken from the browser. Extra fields (price, role, status) in requests are stripped by validation.
- Sessions: random 256-bit token in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie; only a hash is stored. Customers: 30 days, **one active session** (new login revokes old). Staff 12 h, admin 8 h.
- CSRF: every state-changing request needs `X-Requested-With`; CORS is limited to `CLIENT_URL`.
- Roles: public sign-up only ever creates `customer`. Staff are created by the admin. The admin comes from the seed script. Staff/admin cannot use OTP/Google; customers cannot use `/auth/login`.
- Data isolation: customers only load `{_id, customer: me}`; staff only `{outlet ∈ my carts}`; otherwise the answer is `404`. Staff see first name only (no email/phone).
- OTP: stored as HMAC, 10-minute expiry, 5 attempts, 60 s resend cooldown, single use (atomic), rate-limited per IP+email.
- Payments: Razorpay secret never leaves the server; checkout signature and webhook signature (raw body, timing-safe); webhook event ids are stored once; amount is compared; duplicate/late payments raise an admin alert instead of silently double-counting.
- Hardening: `helmet` + CSP, rate limits on API/login/OTP/orders, request size limits, image upload type/size limits with server-chosen filenames, regex-escaped search, no stack traces to clients, audit log of sensitive actions.

## Multiple carts
`Outlet` is one physical cart (code, slug, UPI, hours, pause switch). Orders, payments and staff access all carry the outlet id. Adding a cart = *Admin → Carts → Add cart*, assign staff, print its QR. Menu and prices are shared; `Product.unavailableAtOutlets` already exists for per-cart switches (no screen for it yet).

## Known limitations (be aware)
- Not yet run end to end (see README).
- Refunds: the app **records** refunds; for online payments you must refund in the Razorpay dashboard. Staff cancelling a paid order does not refund automatically.
- Per-customer offer limit is checked before the order is saved; two simultaneous orders by the same person could both pass. The total usage limit is atomic.
- A revoked session's open Socket.io connection stays until it reconnects.
- No customer email/SMS/push notifications; the tracking page must be open (it updates live and re-checks on return).
- Image uploads use local disk (see setup).
- Tax is a single configurable percentage added on top; no GST invoices.
