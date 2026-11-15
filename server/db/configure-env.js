'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

const APP_DB = process.env.APP_DB || 'magizham_db';
const APP_USER = process.env.APP_USER || 'magizham_app';
const PGHOST = process.env.PGHOST || '127.0.0.1';
const PGPORT = Number.parseInt(process.env.PGPORT || '5432', 10);

const DEFAULT_CORS =
  'http://localhost:5501,http://127.0.0.1:5501,http://localhost:5173,http://127.0.0.1:5173';

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;

    if (process.stdin.isTTY && process.stdout.isTTY) {
      muted = true;
      process.stdout.write(question);
      rl.output.write = function () {};
      rl._writeToOutput = function (textToWrite) {
        if (textToWrite.includes(question)) process.stdout.write(textToWrite);
      };
    } else {
      process.stdout.write(question);
    }

    rl.question('', (answer) => {
      rl.close();
      if (muted) process.stdout.write('\n');
      resolve(answer);
    });

    rl.on('SIGINT', () => {
      rl.close();
      reject(new Error('Aborted'));
    });
  });
}

function randomSecret(length) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function readLines() {
  if (!fs.existsSync(ENV_FILE)) return [];
  return fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
}

function readValue(lines, key) {
  const prefix = `${key}=`;
  const line = lines.find(
    (entry) => !entry.trimStart().startsWith('#') && entry.trimStart().startsWith(prefix)
  );
  return line === undefined ? null : line.trimStart().slice(prefix.length);
}

function setValue(lines, key, value) {
  const prefix = `${key}=`;
  const nextLine = `${prefix}${value}`;
  const index = lines.findIndex(
    (entry) => !entry.trimStart().startsWith('#') && entry.trimStart().startsWith(prefix)
  );

  if (index === -1) {
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(nextLine);
    return lines;
  }

  lines[index] = nextLine;
  return lines;
}

function writeEnv(lines) {
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  fs.writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(ENV_FILE, 0o600);
  } catch (err) {
    /* permission bits are not available on every platform */
  }
}

async function main() {
  let password = process.env.APP_PASSWORD || '';

  if (!password) {
    if (!process.stdin.isTTY) {
      throw new Error(
        'APP_PASSWORD is not set and there is no terminal to prompt on.\n' +
          '        Run this command in an interactive PowerShell window.'
      );
    }
    password = await promptHidden(`PostgreSQL password for role "${APP_USER}": `);
  }

  if (!password) {
    throw new Error('The database password cannot be empty.');
  }

  const client = new Client({
    host: PGHOST,
    port: PGPORT,
    user: APP_USER,
    password,
    database: APP_DB,
    application_name: 'magizham-env-setup',
    connectionTimeoutMillis: 10000
  });

  let identity;
  try {
    await client.connect();
    identity = (await client.query('SELECT current_user AS role, current_database() AS database'))
      .rows[0];
  } finally {
    await client.end().catch(() => {});
  }

  const databaseUrl =
    `postgresql://${encodeURIComponent(APP_USER)}:${encodeURIComponent(password)}` +
    `@${PGHOST}:${PGPORT}/${APP_DB}`;

  const lines = readLines();
  const existingSecret = readValue(lines, 'SESSION_SECRET');
  const secret =
    existingSecret && existingSecret.length >= 32 && existingSecret !== 'replace_with_a_long_random_secret'
      ? existingSecret
      : randomSecret(64);

  setValue(lines, 'PORT', readValue(lines, 'PORT') || '5000');
  setValue(lines, 'DATABASE_URL', databaseUrl);
  setValue(lines, 'SESSION_SECRET', secret);
  setValue(lines, 'CORS_ORIGIN', readValue(lines, 'CORS_ORIGIN') || DEFAULT_CORS);
  setValue(lines, 'NODE_ENV', readValue(lines, 'NODE_ENV') || 'development');
  writeEnv(lines);

  console.log('');
  console.log(`[env] connected as "${identity.role}" to database "${identity.database}"`);
  console.log(`[env] wrote ${ENV_FILE} (git-ignored, password not printed)`);
  console.log('[env] next steps:');
  console.log('    npm run db:migrate');
  console.log('    npm run db:seed');
  console.log('    npm run db:verify');
  console.log('    npm run admin:create');
  console.log('    npm run server');
}

main().catch((err) => {
  console.error('[env] FAILED:', err.message);
  if (err.code) console.error('[env] postgres error code:', err.code);
  process.exitCode = 1;
});
