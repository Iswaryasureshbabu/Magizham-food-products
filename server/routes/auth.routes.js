'use strict';

/**
 * Authentication routes:  /api/auth/*
 *
 *   POST /api/auth/register  - create a customer account
 *   POST /api/auth/login     - start a session
 *   POST /api/auth/logout    - end the session
 *   GET  /api/auth/me        - current session (used by the frontend)
 *   GET  /api/auth/admin-check - true only for administrators
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const { query, queryOne } = require('../config/db');
const { validate } = require('../middleware/validate');
const { signToken, setSessionCookie, clearSessionCookie, requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const { ok, created, unauthorized, conflict } = require('../utils/api-response');
const { mapUser } = require('../utils/mappers');

const router = express.Router();

// Basic brute-force protection for the credential endpoints.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Please try again in a few minutes.' }
  }
});

/**
 * `.strict()` makes the schema reject any unknown key, so a client can
 * never smuggle `role: "admin"` into the registration payload.
 */
const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
    email: z.string().trim().toLowerCase().email('Please provide a valid e-mail address.').max(255),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(200)
      .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.')
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please provide a valid e-mail address.'),
    password: z.string().min(1, 'Please enter your password.')
  })
  .strict();

/** POST /api/auth/register */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      return conflict(res, 'An account with this e-mail address already exists.', 'EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

    // The role is hard-coded to 'user' - it can never come from the request.
    const user = await queryOne(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash]
    );

    setSessionCookie(res, signToken(user));
    return created(res, { user: mapUser(user) });
  })
);

/** POST /api/auth/login */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await queryOne(
      'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email]
    );

    // Always run a comparison so the response time does not reveal whether
    // the e-mail address exists.
    const hash = user ? user.password_hash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!user || !passwordMatches) {
      return unauthorized(res, 'Invalid e-mail address or password.');
    }

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
    setSessionCookie(res, signToken(safeUser));
    return ok(res, { user: mapUser(safeUser) });
  })
);

/** POST /api/auth/logout */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    clearSessionCookie(res);
    return ok(res, { message: 'Signed out.' });
  })
);

/** GET /api/auth/me */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, { user: mapUser(req.user) });
  })
);

/** GET /api/auth/admin-check */
router.get(
  '/admin-check',
  requireAuth,
  asyncHandler(async (req, res) => {
    return ok(res, { isAdmin: req.user.role === 'admin' });
  })
);

module.exports = router;
