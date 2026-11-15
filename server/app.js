'use strict';

/**
 * Express application.
 *
 * The API lives under /api. The existing static frontend is served from an
 * explicit allow-list so that neither the backend sources, the .env file
 * nor node_modules can ever be downloaded from the web server.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const env = require('./config/env');
const { attachUser } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const routes = require('./routes');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// The API can be reached on its own origin as well as through the CORS
// allow-list, so both have to be part of the CSP connect-src directive.
const API_ORIGINS = [`http://localhost:${env.port}`, `http://127.0.0.1:${env.port}`];

/* ------------------------------------------------------------------ */
/*  Security headers                                                  */
/* ------------------------------------------------------------------ */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", ...API_ORIGINS, ...env.corsOrigins],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

/* ------------------------------------------------------------------ */
/*  CORS - the frontend runs on a different port during development   */
/* ------------------------------------------------------------------ */

// Development-only: Live Server moves to the next free port when 5501 is
// occupied (for example http://127.0.0.1:59575). Loopback origins are safe
// to accept on any port locally, but never in production.
const DEV_LOOPBACK_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

function isAllowedCorsOrigin(origin) {
  if (env.corsOrigins.includes(origin)) return true;
  if (!env.isProduction && DEV_LOOPBACK_ORIGIN.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    // Same-origin requests (no Origin header) are always allowed.
    if (!origin) return callback(null, true);
    if (env.corsAllowAll) return callback(null, true);
    if (isAllowedCorsOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by the CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

/* ------------------------------------------------------------------ */
/*  Body parsing / cookies                                            */
/* ------------------------------------------------------------------ */

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

/* ------------------------------------------------------------------ */
/*  API                                                               */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'magizham-api',
      time: new Date().toISOString()
    }
  });
});

app.use('/api', attachUser, routes);

app.use('/api', notFoundHandler);

/* ------------------------------------------------------------------ */
/*  Static frontend (allow-list only)                                 */
/* ------------------------------------------------------------------ */

const PUBLIC_PAGES = new Set([
  'index.html',
  'category.html',
  'cart.html',
  'login.html',
  'register.html',
  'checkout.html',
  'orders.html',
  'admin.html',
  'admin-login.html'
]);

const PUBLIC_DIRS = ['css', 'js', 'images'];

for (const dir of PUBLIC_DIRS) {
  app.use(
    `/${dir}`,
    express.static(path.join(env.ROOT_DIR, dir), {
      index: false,
      dotfiles: 'deny',
      fallthrough: true,
      maxAge: env.isProduction ? '1h' : 0
    })
  );
}

app.get('/', (req, res) => {
  res.sendFile(path.join(env.ROOT_DIR, 'index.html'));
});

app.get('/:page', (req, res, next) => {
  const page = String(req.params.page || '');
  if (!PUBLIC_PAGES.has(page)) return next();
  return res.sendFile(path.join(env.ROOT_DIR, page));
});

/* ------------------------------------------------------------------ */
/*  Errors                                                            */
/* ------------------------------------------------------------------ */

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
