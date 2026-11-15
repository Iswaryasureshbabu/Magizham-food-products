// Auth / admin / validation guards on the real Express app, with an in-memory stand-in for PostgreSQL.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

test('API guards: 21 checks (401/403, role escalation, inactive category, image path, stock-safe order status, ...)', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'helpers', 'api-guards-harness.js')], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
  assert.deepStrictEqual(fails, [], fails.join('\n'));
  assert.match(out, /21 passed, 0 failed/);
});
