'use strict';

/**
 * Create (or update) the initial administrator account.
 *
 *   npm run admin:create
 *
 * The password is never stored in plain text - it is hashed with bcrypt
 * (cost 12 by default) before it reaches the database.
 *
 * The password can be supplied in two ways:
 *   1. ADMIN_PASSWORD in the .env file (or as an environment variable)
 *   2. interactively, when the script is run from a terminal
 *
 * No role can ever be granted through the public registration endpoint;
 * this script is the only supported way to create an administrator.
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { pool, query, queryOne } = require('../config/db');

/** Read a password without echoing it back to the terminal. */
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

function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('The admin password must be at least 8 characters long.');
  }
}

async function main() {
  const email = (env.admin.email || '').trim().toLowerCase();
  const name = (env.admin.name || 'Magizham Admin').trim();

  if (!email || !email.includes('@')) {
    throw new Error('Set a valid ADMIN_EMAIL in .env before running this script.');
  }

  let password = env.admin.password;

  if (!password) {
    if (!process.stdin.isTTY) {
      throw new Error(
        'ADMIN_PASSWORD is not set and there is no terminal to prompt on.\n' +
          '        Add ADMIN_PASSWORD=... to your .env file and run it again.'
      );
    }
    password = await promptHidden('Admin password (hidden): ');
  }

  validatePassword(password);

  const hash = await bcrypt.hash(password, env.bcryptRounds);
  const existing = await queryOne('SELECT id, role FROM users WHERE email = $1', [email]);

  let action;
  if (existing) {
    await query(
      `UPDATE users
          SET name = $2, password_hash = $3, role = 'admin'
        WHERE id = $1`,
      [existing.id, name, hash]
    );
    action = `updated existing account (id=${existing.id}, previous role=${existing.role})`;
  } else {
    const created = await queryOne(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id`,
      [name, email, hash]
    );
    action = `created new account (id=${created.id})`;
  }

  console.log('[admin] ' + action);
  console.log(`[admin] email    : ${email}`);
  console.log(`[admin] role     : admin`);
  console.log('[admin] password : stored as a bcrypt hash (never printed back).');
  console.log('[admin] you can now sign in at the admin login page.');
}

main()
  .catch((err) => {
    console.error('[admin] FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
