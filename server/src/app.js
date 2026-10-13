import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { csrfGuard } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { razorpayWebhook } from './controllers/payment.controller.js';
import { UPLOAD_DIR } from './controllers/adminCatalog.controller.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://checkout.razorpay.com', 'https://accounts.google.com'],
        'frame-src': ['https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://accounts.google.com'],
        'connect-src': ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://accounts.google.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'upgrade-insecure-requests': env.isProd ? [] : null,
      },
    },
  }));
  app.use(cors({ origin: env.clientUrl, credentials: true }));

  // Must come BEFORE express.json(): the webhook signature is calculated over the raw bytes.
  app.post('/api/v1/payments/webhook/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
  app.use('/api/v1', apiLimiter, csrfGuard, routes);
  app.use('/api', notFoundHandler);

  // Production: one service serves both the API and the built website (same domain = simple, safe cookies).
  if (env.serveClient) {
    const dist = path.resolve(here, '../../client/dist');
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (req, res, next) => (/^\/(api|uploads|socket\.io)/.test(req.path) ? next() : res.sendFile(path.join(dist, 'index.html'))));
  }

  app.use(errorHandler);
  return app;
}
