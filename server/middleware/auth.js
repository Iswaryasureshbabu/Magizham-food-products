'use strict';

/**
 * Authentication middleware.
 *
 * The session token is a JWT that is stored in an httpOnly cookie
 * (and may also be sent as `Authorization: Bearer <token>` for
 * non-browser clients). The cookie is never readable from JavaScript,
 * which protects the session against XSS.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { queryOne } = require('../config/db');
const { unauthorized, forbidden } = require('../utils/api-response');

/** Create a signed session token for a user row. */
function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role },
    env.sessionSecret,
    { expiresIn: Math.floor(env.sessionMaxAge / 1000) }
  );
}

/** Attach the session cookie to a response. */
function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: env.sessionMaxAge,
    path: '/'
  });
}

/** Remove the session cookie. */
function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/'
  });
}

/** Pull the raw token out of the request (cookie first, then header). */
function extractToken(req) {
  if (req.cookies && req.cookies[env.cookieName]) {
    return req.cookies[env.cookieName];
  }
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * Populates `req.user` when a valid session is present.
 * Never rejects the request - the `requireAuth` guard does that.
 */
async function attachUser(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.sessionSecret);
    const user = await queryOne(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [Number(payload.sub)]
    );
    // The role is read from the database (not from the token) so that a
    // role change takes effect immediately.
    req.user = user || null;
    req.token = token;
  } catch (err) {
    req.user = null;
  }
  return next();
}

/** Reject the request when there is no valid session. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return unauthorized(res, 'Please log in to continue.');
  }
  return next();
}

/** Reject the request when the session is not an administrator. */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return unauthorized(res, 'Please log in to continue.');
  }
  if (req.user.role !== 'admin') {
    return forbidden(res, 'Administrator access is required for this action.');
  }
  return next();
}

module.exports = {
  signToken,
  setSessionCookie,
  clearSessionCookie,
  extractToken,
  attachUser,
  requireAuth,
  requireAdmin
};
