'use strict';

/**
 * PostgreSQL connection module.
 *
 * A single `pg` Pool is created and reused for every request.
 * All queries used by the API are parameterised - no string concatenation
 * of user supplied values.
 */

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: env.isProduction && !/localhost|127\.0\.0\.1/.test(env.databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined
});

// A failed pool connection should not crash the process silently.
pool.on('error', (err) => {
  console.error('[db] unexpected idle client error:', err.message);
});

/**
 * Run a parameterised query.
 * @param {string} text - SQL with $1, $2 ... placeholders
 * @param {Array<any>} params - values bound to the placeholders
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

/** Convenience helper returning the first row (or null). */
async function queryOne(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

/**
 * Run `fn` inside a transaction. The callback receives a dedicated client.
 * The transaction is rolled back automatically on any error.
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Verify that the database is reachable and the schema exists. */
async function testConnection() {
  const started = Date.now();
  const row = await queryOne('SELECT current_database() AS database, version() AS version');
  return {
    ok: true,
    database: row.database,
    version: row.version,
    latencyMs: Date.now() - started
  };
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  queryOne,
  transaction,
  testConnection,
  closePool
};
