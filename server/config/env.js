'use strict';

/**
 * Central environment configuration.
 *
 * Secrets are read from the project-root ".env" file (git-ignored) and are
 * never hardcoded. Nothing in this file is shipped to the browser.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Load .env (silently - the file may legitimately not exist yet)
if (fs.existsSync(ENV_FILE)) {
  dotenv.config({ path: ENV_FILE });
}

function required(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy .env.example to .env and set it.`
    );
  }
  return value;
}

function toInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const corsOrigins = required('CORS_ORIGIN', 'http://localhost:5501,http://127.0.0.1:5501')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const sessionSecret = required('SESSION_SECRET');

if (isProduction && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}

module.exports = {
  ROOT_DIR,
  SERVER_DIR: path.resolve(__dirname, '..'),
  nodeEnv,
  isProduction,
  port: toInt('PORT', 5000),

  databaseUrl: required('DATABASE_URL'),
  sessionSecret,
  sessionMaxAge: toInt('SESSION_MAX_AGE', 7 * 24 * 60 * 60 * 1000),
  bcryptRounds: toInt('BCRYPT_ROUNDS', 12),

  corsOrigins,
  // Allow any origin only when explicitly asked (local testing convenience).
  corsAllowAll: process.env.CORS_ALLOW_ALL === 'true',

  cookieName: 'magizham_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProduction,

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@magizhamfoods.com',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Magizham Admin'
  }
};
