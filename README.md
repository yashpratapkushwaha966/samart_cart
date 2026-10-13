# Smart Momos Pushcart Platform

One project, three panels, one backend, one MongoDB database.

| Panel | URL | Who |
|---|---|---|
| Customer | `/` (QR opens `/c/<cart-slug>`) | People ordering momos |
| Cart Staff | `/staff` | The person at the cart (login created by the owner) |
| Admin | `/admin` | The owner |

```
client/   React + Vite + Tailwind + Framer Motion      (all three panels)
server/   Node + Express + Mongoose + Socket.io        (one API: /api/v1)
docs/     architecture.md  api.md  database-schema.md  setup.md
tools/    check-imports.mjs  (offline sanity checker)
```

**Start here: [docs/setup.md](docs/setup.md)**

## Honest status

Written and checked in an environment with **no internet and no MongoDB**, so the full app has **not been run end to end yet**.

| Check | Result |
|---|---|
| Business-rule unit tests (status rules, pricing, offers, codes, OTP, signatures, time, UPI link) | 25 passing |
| Input-validation tests against real `zod` | 10 passing |
| Syntax check, every server and client file | passing |
| All imports / named exports / react-icons names resolve | passing |
| Integration test (customer → staff → admin, permissions, duplicate payments, webhook): `server/tests/integration/orderFlow.test.js` | **written, NOT run** |
| `npm install`, `vite build`, real browser, real Atlas, real Razorpay / Google / SMTP | **NOT run** |

Run `npm test` and `npm run test:integration` in `server/` on your computer first. Fix anything that fails before trusting the app with money.
