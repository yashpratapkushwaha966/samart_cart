import { forbidden } from '../utils/AppError.js';

// Our browser app always sends this header. A form on another website cannot add a custom header
// (and CORS blocks other origins), so cross-site request forgery is not possible on cookie sessions.
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.originalUrl.startsWith('/api/v1/payments/webhook/')) return next(); // signed by the gateway instead
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(forbidden('Blocked request', 'CSRF_BLOCKED'));
  return next();
}
