'use strict';

/**
 * Consistent JSON response helpers.
 *
 * Every response uses the same envelope:
 *   success: true  ->  { success: true, data: ... }
 *   success: false ->  { success: false, error: { code, message, details? } }
 */

/** 200 - OK */
function ok(res, data = null, status = 200) {
  return res.status(status).json({ success: true, data });
}

/** 201 - Created */
function created(res, data = null) {
  return res.status(201).json({ success: true, data });
}

/** 400 - Bad request */
function badRequest(res, message, details) {
  return res.status(400).json({
    success: false,
    error: { code: 'BAD_REQUEST', message, ...(details ? { details } : {}) }
  });
}

/** 401 - Not authenticated */
function unauthorized(res, message = 'Authentication required.') {
  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message }
  });
}

/** 403 - Authenticated but not allowed */
function forbidden(res, message = 'You do not have permission to perform this action.') {
  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message }
  });
}

/** 404 - Not found */
function notFound(res, message = 'Resource not found.') {
  return res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message }
  });
}

/** 409 - Conflict (duplicate email, insufficient stock, ...) */
function conflict(res, message, code = 'CONFLICT') {
  return res.status(409).json({
    success: false,
    error: { code, message }
  });
}

/** 500 - Server error */
function serverError(res, message = 'Something went wrong on our side.') {
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message }
  });
}

module.exports = {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
};
