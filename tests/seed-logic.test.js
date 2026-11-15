// Seed decision logic, run against an in-memory stand-in for PostgreSQL (no real DB needed).
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

function run(...args) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'helpers', 'seed-harness.js'), ...args], { encoding: 'utf8' });
  const line = (r.stdout + r.stderr).split('\n').find((l) => l.startsWith('RESULT')) || '';
  return { out: r.stdout + r.stderr, line, status: r.status };
}

test('fresh database: creates 6 categories and 54 products', () => {
  const r = run('fresh');
  assert.match(r.line, /exit=0 products_in_db=54 active_cats=6/);
});

test('seeding twice creates no duplicates (idempotent)', () => {
  const r = run('twice');
  assert.match(r.line, /exit=0 products_in_db=54 active_cats=6/);
  assert.match(r.out, /0 would be\/was created, 54 updated/);
});

test('dry run writes nothing', () => {
  const r = run('fresh', '--dry-run');
  assert.match(r.line, /products_in_db=0/);
});

test('an id held by a different product stops the seed and writes nothing', () => {
  const r = run('legacy');
  assert.strictEqual(r.status, 1);
  assert.match(r.out, /id 5: wants/);
  assert.match(r.line, /products_in_db=2 /); // the 2 pre-existing rows only
});

test('a renamed legacy pickle keeps its id and its stock; obsolete categories are deactivated', () => {
  const r = run('legacyok');
  assert.match(r.line, /exit=0/);
  assert.match(r.line, /"id":30,"cat":2,"name":"Tomato Pickle \(100g\)"/);
  assert.match(r.line, /"stock":12/);
  assert.match(r.out, /deactivated obsolete categories: millets/);
});
