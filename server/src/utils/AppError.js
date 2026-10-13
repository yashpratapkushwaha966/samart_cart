// One error type for every "expected" failure. The error middleware turns it into JSON.
export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
export const badRequest = (m, c = 'BAD_REQUEST', d) => new AppError(400, m, c, d);
export const unauthorized = (m = 'Please log in', c = 'UNAUTHORIZED') => new AppError(401, m, c);
export const forbidden = (m = 'You are not allowed to do this', c = 'FORBIDDEN') => new AppError(403, m, c);
export const notFound = (m = 'Not found', c = 'NOT_FOUND') => new AppError(404, m, c);
export const conflict = (m, c = 'CONFLICT', d) => new AppError(409, m, c, d);
