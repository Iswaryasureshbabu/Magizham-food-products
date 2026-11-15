'use strict';

/**
 * Quick PostgreSQL connectivity check.
 *
 *   npm run db:test
 *
 * Exits with code 1 when the database cannot be reached, so it can be used
 * in CI or as a pre-flight step before `npm run server`.
 */

const { testConnection, closePool } = require('../config/db');

async function main() {
  try {
    const result = await testConnection();
    console.log('[db:test] connection OK');
    console.log(`[db:test] database : ${result.database}`);
    console.log(`[db:test] version  : ${result.version.split(',')[0]}`);
    console.log(`[db:test] latency  : ${result.latencyMs} ms`);

    const { rows } = await require('../config/db').query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name;
    `);
    console.log('[db:test] tables   : ' + (rows.map((r) => r.table_name).join(', ') || '(none - run npm run db:migrate)'));
    process.exitCode = 0;
  } catch (err) {
    console.error('[db:test] connection FAILED:', err.message);
    if (err.code) console.error('[db:test] postgres error code:', err.code);
    console.error('[db:test] check your DATABASE_URL in .env and that PostgreSQL is running.');
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
}

main();
