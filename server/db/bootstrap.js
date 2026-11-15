'use strict';

/**
 * One-time PostgreSQL bootstrap for the Magizham backend.
 *
 *   npm run db:bootstrap
 *
 * It creates the two objects the application needs and nothing else:
 *
 *   1. the login role  `magizham_app`  (least privilege, owns nothing else)
 *   2. the database    `magizham_db`
 *
 * The script is idempotent - running it again only repairs what is missing,
 * it never drops a database, a role or any data.
 *
 * The PostgreSQL superuser password is read from the standard libpq
 * environment variable `PGPASSWORD` (see .env.example). It is never written
 * to disk and never printed.
 *
 * Afterwards the script writes / refreshes the project `.env` file with
 * DATABASE_URL and a freshly generated SESSION_SECRET. `.env` is
 * git-ignored, so no credential ever reaches the repository.
 *
 * Optional environment variables:
 *   PGHOST     (default 127.0.0.1)
 *   PGPORT     (default 5432)
 *   PGUSER     (default postgres)
 *   PGPASSWORD (required - superuser password)
 *   APP_DB     (default magizham_db)
 *   APP_USER   (default magizham_app)
 *   APP_PASSWORD  (optional - generated when omitted)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

const SUPERUSER = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number.parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  connectionTimeoutMillis: 10000
};

const APP_DB = process.env.APP_DB || 'magizham_db';
const APP_USER = process.env.APP_USER || 'magizham_app';

// Identifiers are interpolated into a few statements, so they are restricted
// to a strict pattern before anything is executed.
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

for (const [label, value] of [['APP_DB', APP_DB], ['APP_USER', APP_USER]]) {
  if (!SAFE_IDENTIFIER.test(value)) {
    console.error(
      `[bootstrap] ${label}="${value}" is not a valid PostgreSQL identifier ` +
        '(letters, digits and underscore only).'
    );
    process.exit(1);
  }
}

/** Password alphabet: unreserved URL characters only. */
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomSecret(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

/**
 * Run an identifier-locked statement.
 * The identifier is validated against a strict pattern, the value is passed
 * through PostgreSQL's own quoting (%L) so nothing can be injected.
 */
async function runLiteral(client, template, identifier, value) {
  const { rows } = await client.query(`SELECT format('${template}', $1, $2) AS stmt`, [
    identifier,
    value
  ]);
  await client.query(rows[0].stmt);
}

/** Read the existing .env into an ordered list of "KEY=VALUE" lines. */
function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return [];
  return fs
    .readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !/^\s*#/.test(line));
}

/** Replace or append a key inside the .env lines. */
function setEnvValue(lines, key, value) {
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  const line = `${prefix}${value}`;
  if (index === -1) return lines.concat([line]);
  const copy = lines.slice();
  copy[index] = line;
  return copy;
}

function writeEnvFile(lines) {
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  // writeFileSync only applies the mode when the file is created - an
  // existing .env keeps its old permissions.
  try {
    fs.chmodSync(ENV_FILE, 0o600);
  } catch (err) {
    /* not supported on every platform - the file is git-ignored anyway */
  }
}

async function main() {
  if (!SUPERUSER.password) {
    console.error('[bootstrap] Missing superuser password.');
    console.error('[bootstrap] Set it for this shell session and run the command again:');
    console.error('');
    console.error('    $env:PGPASSWORD = "your-postgres-password"   # PowerShell');
    console.error('    npm run db:bootstrap');
    console.error('');
    console.error('[bootstrap] (cmd.exe:  set PGPASSWORD=your-postgres-password)');
    process.exitCode = 1;
    return;
  }

  const appPassword = process.env.APP_PASSWORD || randomSecret(28);
  const generatedPassword = !process.env.APP_PASSWORD;

  console.log(`[bootstrap] connecting to PostgreSQL at ${SUPERUSER.host}:${SUPERUSER.port} as "${SUPERUSER.user}" ...`);
  const client = new Client(SUPERUSER);
  await client.connect();

  try {
    // ---- 1. the login role -------------------------------------------
    const roleExists = (
      await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_USER])
    ).rowCount > 0;

    if (roleExists) {
      console.log(`[bootstrap] role "${APP_USER}" already exists - updating its password.`);
      await runLiteral(
        client,
        'ALTER ROLE %I WITH LOGIN PASSWORD %L',
        APP_USER,
        appPassword
      );
    } else {
      console.log(`[bootstrap] creating role "${APP_USER}" ...`);
      await runLiteral(
        client,
        'CREATE ROLE %I WITH LOGIN PASSWORD %L',
        APP_USER,
        appPassword
      );
    }

    // ---- 2. the database ---------------------------------------------
    const dbExists = (
      await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [APP_DB])
    ).rowCount > 0;

    if (dbExists) {
      console.log(`[bootstrap] database "${APP_DB}" already exists - keeping every row in it.`);
    } else {
      console.log(`[bootstrap] creating database "${APP_DB}" ...`);
      // CREATE DATABASE cannot run inside a transaction block.
      await client.query(`CREATE DATABASE "${APP_DB}" ENCODING 'UTF8' TEMPLATE template0`);
    }

    // ---- 3. privileges inside the database ----------------------------
    await client.query(`GRANT CONNECT ON DATABASE "${APP_DB}" TO "${APP_USER}"`);

    // Connect to the application database for the schema level grants.
    const appClient = new Client({
      ...SUPERUSER,
      database: APP_DB,
      password: SUPERUSER.password
    });
    await appClient.connect();
    try {
      await appClient.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${APP_USER}"`);
      await appClient.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${APP_USER}"`
      );
      await appClient.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${APP_USER}"`
      );
      await appClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${APP_USER}"`
      );
      await appClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${APP_USER}"`
      );
    } finally {
      await appClient.end();
    }

    // ---- 4. the .env file --------------------------------------------
    const databaseUrl =
      `postgresql://${encodeURIComponent(APP_USER)}:${encodeURIComponent(appPassword)}` +
      `@${SUPERUSER.host}:${SUPERUSER.port}/${APP_DB}`;

    let lines = readEnvFile();
    lines = setEnvValue(lines, 'PORT', '5000');
    lines = setEnvValue(lines, 'DATABASE_URL', databaseUrl);
    lines = setEnvValue(lines, 'SESSION_SECRET', randomSecret(48));
    lines = setEnvValue(
      lines,
      'CORS_ORIGIN',
      'http://localhost:5501,http://127.0.0.1:5501,http://localhost:5173,http://127.0.0.1:5173'
    );
    lines = setEnvValue(lines, 'NODE_ENV', 'development');
    writeEnvFile(lines);

    console.log('');
    console.log(`[bootstrap] role     : ${APP_USER}${generatedPassword ? ' (password generated)' : ''}`);
    console.log(`[bootstrap] database : ${APP_DB}`);
    console.log(`[bootstrap] .env     : ${ENV_FILE} (git-ignored, never committed)`);
    console.log('[bootstrap] the database password and the session secret are stored in .env only.');
    console.log('');
    console.log('[bootstrap] next steps:');
    console.log('    npm run db:migrate     # create the tables (safe, idempotent)');
    console.log('    npm run db:seed        # import the existing product catalogue');
    console.log('    npm run admin:create   # create the first administrator');
    console.log('    npm run server         # start the API');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[bootstrap] FAILED:', err.message);
  if (err.code) console.error('[bootstrap] postgres error code:', err.code);
  process.exitCode = 1;
});
