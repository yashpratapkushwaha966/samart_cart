import { badRequest } from '../utils/AppError.js';

// validate({ body: zodSchema, query: zodSchema, params: zodSchema })
// Parsed, cleaned values are placed on req.valid.body / req.valid.query / req.valid.params.
export const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(badRequest(details[0]?.message || 'Invalid data', 'VALIDATION_ERROR', details));
    }
    req.valid[part] = result.data;
  }
  return next();
};
