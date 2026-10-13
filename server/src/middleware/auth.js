import { asyncHandler } from '../utils/asyncHandler.js';
import { forbidden, unauthorized } from '../utils/AppError.js';
import { resolveSession } from '../services/authService.js';

// Runs on every request: if a valid session cookie exists, req.user is set.
export const attachUser = asyncHandler(async (req, res, next) => {
  const found = await resolveSession(req.cookies?.sid);
  if (found) {
    req.user = found.user;
    req.session = found.session;
  }
  next();
});

export const requireAuth = (req, res, next) => (req.user ? next() : next(unauthorized()));

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  return roles.includes(req.user.role) ? next() : next(forbidden());
};
