import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.isOperational ? err.message : 'Something went wrong on our side';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400; code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    message = details[0]?.message || 'Invalid data';
  } else if (err.name === 'CastError') {
    status = 400; code = 'BAD_ID'; message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE';
    message = `That ${Object.keys(err.keyPattern || {})[0] || 'value'} is already in use`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Invalid JSON body';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400; code = 'FILE_TOO_LARGE'; message = 'Image must be 2 MB or smaller';
  }

  if (status >= 500) logger.error('Unhandled error', { path: req.originalUrl, method: req.method, error: err.message, stack: env.isProd ? undefined : err.stack });
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}
