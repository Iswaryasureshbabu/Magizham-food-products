'use strict';

/**
 * Global error handling.
 *
 * Known error types are translated into meaningful HTTP status codes,
 * everything else is logged and reported as a generic 500 so that no
 * internal detail (SQL, stack traces, ...) leaks to the client.
 */

const { ZodError } = require('zod');
const env = require('../config/env');
const { badRequest, notFound, serverError } = require('../utils/api-response');
const { formatZodError } = require('./validate');

/** 404 handler for unknown routes. */
function notFoundHandler(req, res) {
  return notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Business errors thrown inside a transaction (empty cart, out of stock, ...)
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code || 'BAD_REQUEST', message: err.message }
    });
  }

  // Validation errors
  if (err instanceof ZodError) {
    return badRequest(res, 'The submitted data is not valid.', formatZodError(err));
  }

  // PostgreSQL: unique violation (duplicate e-mail, duplicate cart row, ...)
  if (err.code === '23505') {
    return badRequest(res, 'That record already exists.');
  }

  // PostgreSQL: foreign key violation
  if (err.code === '23503') {
    return badRequest(res, 'The referenced record does not exist.');
  }

  // PostgreSQL: check constraint violation (invalid quantity / price, ...)
  if (err.code === '23514') {
    return badRequest(res, 'The submitted values are not allowed.');
  }

  // Invalid JSON body
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return badRequest(res, 'The request body is not valid JSON.');
  }

  // Body too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' }
    });
  }

  console.error('[error]', req.method, req.originalUrl, '-', err.stack || err.message);

  if (err.message && /database connection|ECONNREFUSED|timeout|terminated/i.test(err.message)) {
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not reachable right now.' }
    });
  }

  return serverError(
    res,
    env.isProduction ? 'Something went wrong on our side.' : err.message || 'Unexpected error.'
  );
}

module.exports = { notFoundHandler, errorHandler };
