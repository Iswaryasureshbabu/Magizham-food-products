'use strict';

/**
 * Magizham Food Products - API server entry point.
 *
 *   npm run server        production style start
 *   npm run server:dev    with nodemon (auto restart)
 */

const app = require('./app');
const env = require('./config/env');
const { testConnection, closePool } = require('./config/db');

async function start() {
  console.log('[server] Magizham Food Products API');
  console.log(`[server] environment : ${env.nodeEnv}`);
  console.log(`[server] listening on: http://localhost:${env.port}`);

  // Fail fast with a clear message when the database is not reachable.
  try {
    const info = await testConnection();
    console.log(`[server] database     : "${info.database}" connected (${info.latencyMs} ms)`);
  } catch (err) {
    console.error('[server] DATABASE CONNECTION FAILED:', err.message);
    console.error('[server] check DATABASE_URL in .env and that PostgreSQL is running.');
    console.error('[server] the API will start anyway and report errors per request.');
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] ready - API base URL: http://localhost:${env.port}/api`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
