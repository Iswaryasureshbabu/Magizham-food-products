'use strict';

/**
 * Request validation middleware (powered by zod).
 *
 *   router.post('/register', validate(registerSchema), handler)
 *
 * The parsed (and coerced) value replaces the raw request body, so the
 * route handlers only ever see validated data.
 */

const { ZodError } = require('zod');
const { badRequest } = require('../utils/api-response');

function formatZodError(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message
  }));
}

function validate(schema, source = 'body') {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return badRequest(
        res,
        'The submitted data is not valid.',
        formatZodError(result.error)
      );
    }
    req[source] = result.data;
    return next();
  };
}

/** Helper for route handlers that need the raw ZodError. */
function zodErrorHandler(error, res) {
  if (error instanceof ZodError) {
    return badRequest(res, 'The submitted data is not valid.', formatZodError(error));
  }
  return null;
}

module.exports = { validate, formatZodError, zodErrorHandler };
