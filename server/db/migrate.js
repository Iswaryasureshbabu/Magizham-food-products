'use strict';

/**
 * Database migration runner.
 *
 *   npm run db:migrate           -> create tables if they do not exist (safe)
 *   npm run db:migrate -- --force -> DROP the magizham tables first, then recreate
 *
 * The SQL lives in server/db/schema.sql so it can also be applied with psql:
 *   psql -U postgres -d magizham_db -f server/db/schema.sql
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

const DROP_SQL = `
  DROP TABLE IF EXISTS order_items CASCADE;
  DROP TABLE IF EXISTS orders CASCADE;
  DROP TABLE IF EXISTS cart_items CASCADE;
  DROP TABLE IF EXISTS products CASCADE;
  DROP TABLE IF EXISTS categories CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
`;

async function main() {
  const force = process.argv.includes('--force');

  // Safety interlock: --force DELETES every table (users, products, carts and
  // ORDER HISTORY). It only runs when this is set deliberately, so a mistyped
  // `npm run db:reset` can never wipe a live shop.
  if (force && process.env.ALLOW_DB_RESET !== 'yes') {
    console.error('[migrate] REFUSED: --force would delete all tables, including orders.');
    console.error('[migrate] If you really want that on a throw-away database, set ALLOW_DB_RESET=yes for this one command.');
    process.exitCode = 1;
    return;
  }

  console.log('[migrate] connecting to the database...');
  const client = await pool.connect();
  try {
    const db = await client.query('SELECT current_database() AS db');
    console.log(`[migrate] connected to database "${db.rows[0].db}"`);

    if (force) {
      console.log('[migrate] --force: dropping existing magizham tables...');
      await client.query(DROP_SQL);
    }

    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await client.query(sql);
    console.log('[migrate] schema applied successfully.');

    const tables = await client.query(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name;
    `);
    console.log('[migrate] tables present: ' + tables.rows.map((r) => r.table_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err.message);
  if (err.code) console.error('[migrate] postgres error code:', err.code);
  process.exit(1);
});
