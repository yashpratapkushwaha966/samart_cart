# Setup guide

Needs **Node 20+** (`node -v`) and a free **MongoDB Atlas** account.

## 1. MongoDB Atlas
1. Create a free cluster (M0) at mongodb.com/atlas.
2. *Database Access* → add a user with a strong password (note it).
3. *Network Access* → add your IP. For a hosted site add the host's IP, or `0.0.0.0/0` together with a strong password.
4. *Connect → Drivers* → copy the `mongodb+srv://…` string. Put `/smart-momos` before the `?` to name the database.

## 2. Server
```bash
cd server
npm install
cp .env.example .env        # then edit .env
```
Fill in `.env`:
- `MONGODB_URI`: from step 1.
- `APP_SECRET`: run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters): your owner login. Used only by the seed script.
- `SESSION_CUSTOMER_HOURS` (default 720 = 30 days), `SESSION_STAFF_HOURS` (12), `SESSION_ADMIN_HOURS` (8): how long a login lasts. Restart the server after changing.
- `COMPLETE_NEEDS_PIN=true`: staff must type the customer's permanent 4-digit PIN (plus the order code) to hand over an order. `false` turns the PIN check off.
- `OTP_CHANNEL=email` (only option today). Contact-number OTP can be added later in `src/services/otpDelivery.js`.
- Email OTP (`SMTP_*`) is optional in development. Without it the code is **printed in the server terminal**.

```bash
npm test                    # business-rule + validation tests
npm run seed                # creates admin, one cart, settings, sample menu (dev only)
npm run dev                 # API on http://localhost:5000
```
Optional: set `SEED_STAFF_EMAIL` / `SEED_STAFF_PASSWORD` before seeding to also create a staff login.

## 3. Client
```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```
Open `http://localhost:5173` (customer), `/staff/login`, `/admin/login`.
Test on a phone on the same Wi-Fi: open `http://<your-computer-ip>:5173`.

Optional: put `hero-family.mp4` and `hero-students.mp4` in `client/public/` for the home page background (see `client/public/README-hero-video.txt`). They play one after another. Without them an animated background is shown.

## 4. First things to do in the Admin panel
1. **Carts & Staff** → edit your cart: set the **UPI id**, opening hours; add a **staff member**.
2. **Menu** → replace the sample items/prices and **upload real photos**.
3. **Settings** → business name, packaging fee, cancellation window. Leave tax OFF until your accountant says otherwise.
4. **Carts & Staff → QR code** → print it (only after the site is deployed, see step 8).

## 5. Email OTP
Gmail: turn on 2-step verification, create an **App Password**, then
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`.
For real traffic use Brevo / Resend / Amazon SES SMTP (Gmail limits daily sends). In production the server refuses to start without SMTP.

## 6. Google sign-in
1. console.cloud.google.com → new project → *APIs & Services → OAuth consent screen* (External).
2. *Credentials → Create → OAuth client ID → Web application*.
3. *Authorized JavaScript origins*: `http://localhost:5173` and your real site URL.
4. Put the Client ID in `server/.env` as `GOOGLE_CLIENT_ID` **and** `client/.env` as `VITE_GOOGLE_CLIENT_ID` (copy `client/.env.example`). Restart both.

## 7. Razorpay (online payments)
1. Sign up at razorpay.com. **Test mode needs no KYC and charges nothing.**
2. *Settings → API Keys* → generate **Test** keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
3. *Settings → Payment capture* → **Automatic**.
4. Webhook (needs a public https URL; locally use a tunnel such as `ngrok http 5000`):
   *Settings → Webhooks → Add* → URL `https://<your-site>/api/v1/payments/webhook/razorpay`,
   events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
   set a secret → `RAZORPAY_WEBHOOK_SECRET`.
5. Test card: Razorpay lists test cards in its docs. Verify: pay → order turns **Paid** → Admin shows it under *Online*.
6. For real money: complete KYC, switch to **Live** keys, repeat the webhook for live mode.
Without keys, "Pay online" is hidden from customers. Nothing is faked.

## 8. Deploy (one service, one domain: simplest and safest)
Works on Render, Railway, Fly.io or any VPS.
```bash
cd client && npm install && npm run build         # creates client/dist
cd ../server && npm install --omit=dev
NODE_ENV=production SERVE_CLIENT=true npm start
```
Production environment variables: everything in `server/.env.example`, plus
`NODE_ENV=production`, `SERVE_CLIENT=true`, `TRUST_PROXY=1`, `CLIENT_URL=https://your-domain.com` (no trailing slash).
Run `npm run seed` once against the production database (it will **not** insert the sample menu in production; add `-- --with-sample-menu` only if you want it).
Use https only (hosts give it free).

Render example: Build command `cd client && npm install && npm run build && cd ../server && npm install`, Start command `cd server && npm start`.

**Image uploads** are saved in `server/uploads/`. Many hosts wipe the disk on every deploy. Attach a persistent disk mounted at `server/uploads`, or ask a developer to move uploads to Cloudinary / S3.

## 9. Before real customers (checklist)
- [ ] `npm test` and `npm run test:integration` pass on your computer
- [ ] Full manual run-through on a phone: order → staff accept/prepare/ready → confirm payment → complete (cash, UPI, online test mode)
- [ ] Strong, unique `ADMIN_PASSWORD` and `APP_SECRET`; `.env` never uploaded to GitHub
- [ ] MongoDB Atlas backups enabled; network access restricted
- [ ] Real SMTP provider, https, real `CLIENT_URL`; QR printed **after** this is set
- [ ] Your own UPI id set; staff trained to verify UPI in their bank app (not screenshots)
- [ ] Razorpay KYC + live keys + live webhook (if using online payments); try one real ₹1 payment, then refund it
- [ ] Legal and tax (talk to a professional): FSSAI registration/licence, GST applicability, Razorpay business terms, a Privacy Policy and Terms page (you store customer emails), refund policy
- [ ] Decide what to do on a power-cut/network loss at the cart: staff can still see the queue on refresh; keep a paper fallback
