'use strict';

/**
 * Seed the PostgreSQL database with the products that already exist in the
 * frontend data file (js/products.js).
 *
 *   npm run db:seed
 *
 * - Product names, descriptions, prices, weights, images and category
 *   assignments are copied verbatim from js/products.js.
 * - The original numeric ids are preserved so the ids used by the existing
 *   frontend (and any localStorage cart) keep matching the database.
 * - The script is idempotent: running it twice updates the existing rows
 *   instead of creating duplicates.
 * - Everything runs in ONE transaction. If a product id is already used by a
 *   different product ("collision") nothing is written: the collisions are
 *   listed and the script exits with code 1. ids are never reassigned silently.
 *
 *   npm run db:seed -- --dry-run   -> show the plan, write nothing
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pool } = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'js', 'products.js');

const DEFAULT_STOCK = Number.parseInt(process.env.SEED_STOCK_QUANTITY || '50', 10);

/** Load the existing frontend catalogue without a browser. */
function loadSourceCatalogue() {
  const source = fs.readFileSync(SOURCE_FILE, 'utf8');
  const sandbox = { Object, Array, JSON, String, Number, parseInt, parseFloat };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: SOURCE_FILE });
  if (!sandbox.products) throw new Error('Could not read the products object from js/products.js');
  return sandbox.products;
}

/** "Idli Podi" -> "idli-podi" */
function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "₹45" -> 45 */
function parsePrice(value) {
  const num = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(num)) throw new Error(`Cannot parse price "${value}"`);
  return num;
}

async function upsertCategory(db, cat) {
  const row = await db.queryOne(
    `INSERT INTO categories
        (category_name, category_slug, description, category_name_ta, description_ta, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (category_slug) DO UPDATE SET
        category_name   = EXCLUDED.category_name,
        description     = EXCLUDED.description,
        category_name_ta = EXCLUDED.category_name_ta,
        description_ta  = EXCLUDED.description_ta,
        is_active       = EXCLUDED.is_active,
        display_order   = EXCLUDED.display_order
     RETURNING id, (xmax = 0) AS inserted`,
    [
      cat.name,
      cat.id,
      cat.banner || null,
      cat.nameTa || null,
      cat.bannerTa || null,
      cat.isActive !== false,
      cat.displayOrder || 0
    ]
  );
  return row;
}

/**
 * Insert or update one product. Lookup order:
 *   1. same category + same slug            -> update
 *   2. same category + prod.legacySlug      -> update (the product was renamed)
 *   3. prod.id is free                      -> insert with that id
 *   4. prod.id belongs to someone else      -> COLLISION (reported, nothing written)
 * stock_quantity is never touched on update.
 */
async function upsertProduct(db, categoryId, prod) {
  const slug = slugify(prod.name);
  const fields = [
    prod.name,                          // $1 product_name
    slug,                               // $2 product_slug
    prod.desc || null,                  // $3 description
    prod.descTa || null,                // $4 description_ta
    prod.nameTa || null,                // $5 product_name_ta
    parsePrice(prod.price),             // $6 price
    prod.weight || null,                // $7 weight
    `images/${prod.image}`,             // $8 image_url
    prod.avail === false ? false : true // $9 is_available
  ];

  const updateSql = `UPDATE products
        SET product_name = $1, product_slug = $2, description = $3, description_ta = $4,
            product_name_ta = $5, price = $6, weight = $7, image_url = $8, is_available = $9
      WHERE id = $10
      RETURNING id`;

  let existing = await db.queryOne(
    'SELECT id FROM products WHERE category_id = $1 AND product_slug = $2',
    [categoryId, slug]
  );
  if (!existing && prod.legacySlug) {
    existing = await db.queryOne(
      'SELECT id FROM products WHERE category_id = $1 AND product_slug = $2',
      [categoryId, prod.legacySlug]
    );
  }
  if (existing) {
    await db.queryOne(updateSql, [...fields, existing.id]);
    return { id: existing.id, inserted: false };
  }

  const owner = await db.queryOne(
    `SELECT p.id, p.product_name, c.category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1`,
    [prod.id]
  );
  if (owner) {
    return {
      collision: {
        id: prod.id,
        wanted: `${prod.name} (${slug})`,
        heldBy: `${owner.product_name} [${owner.category_slug}]`
      }
    };
  }

  await db.queryOne(
    `INSERT INTO products
        (id, category_id, product_name, product_slug, description, description_ta,
         product_name_ta, price, weight, image_url, stock_quantity, is_available)
     VALUES ($10, $11, $1, $2, $3, $4, $5, $6, $7, $8, $12, $9)
     RETURNING id`,
    [...fields, prod.id, categoryId, DEFAULT_STOCK]
  );
  return { id: prod.id, inserted: true };
}

async function resetSequence(db, table, column) {
  await db.query(
    `SELECT setval(
       pg_get_serial_sequence('${table}', '${column}'),
       COALESCE((SELECT MAX(${column}) FROM ${table}), 1),
       true
     );`
  );
}

async function main() {
  console.log(`[seed] loading existing catalogue from js/products.js ... ${DRY_RUN ? '(DRY RUN - nothing will be written)' : ''}`);
  const catalogue = loadSourceCatalogue();
  const categoryKeys = Object.keys(catalogue);

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let productsCreated = 0;
  let productsUpdated = 0;
  const collisions = [];

  const client = await pool.connect();
  const db = {
    query: (text, params = []) => client.query(text, params),
    queryOne: async (text, params = []) => (await client.query(text, params)).rows[0] || null
  };

  try {
    await client.query('BEGIN');

    for (let idx = 0; idx < categoryKeys.length; idx++) {
      const key = categoryKeys[idx];
      const cat = catalogue[key];
      const category = await upsertCategory(db, {
        id: key,
        name: cat.name,
        nameTa: cat.nameTa,
        banner: cat.banner,
        bannerTa: cat.bannerTa,
        isActive: true,
        displayOrder: cat.displayOrder || idx + 1
      });
      if (category.inserted) categoriesCreated += 1;
      else categoriesUpdated += 1;

      for (const prod of cat.products) {
        const result = await upsertProduct(db, category.id, prod);
        if (result.collision) collisions.push(result.collision);
        else if (result.inserted) productsCreated += 1;
        else productsUpdated += 1;
      }
    }

    if (collisions.length) {
      await client.query('ROLLBACK');
      console.error(`[seed] STOPPED: ${collisions.length} product id collision(s). NOTHING was written.`);
      collisions.forEach((c) =>
        console.error(`[seed]   id ${c.id}: wants "${c.wanted}" but the id is used by "${c.heldBy}"`)
      );
      console.error('[seed] Resolve the mapping for these rows first (send this list for review).');
      process.exitCode = 1;
      return;
    }

    // Deactivate (never delete) categories that are not in the pamphlet catalogue.
    const deactivated = await db.query(
      `UPDATE categories
          SET is_active = FALSE
        WHERE category_slug NOT IN (${categoryKeys.map((_, i) => `$${i + 1}`).join(', ')})
          AND is_active = TRUE
        RETURNING category_slug`,
      categoryKeys
    );
    if (deactivated.rows.length) {
      console.log('[seed] deactivated obsolete categories: ' + deactivated.rows.map((r) => r.category_slug).join(', '));
    }

    await resetSequence(db, 'categories', 'id');
    await resetSequence(db, 'products', 'id');

    const totals = (
      await db.query(`
        SELECT
          (SELECT COUNT(*) FROM categories WHERE is_active) AS categories,
          (SELECT COUNT(*) FROM products p JOIN categories c ON c.id = p.category_id WHERE c.is_active) AS products;
      `)
    ).rows[0];

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('[seed] dry run complete - rolled back.');
    } else {
      await client.query('COMMIT');
      console.log('[seed] done (committed).');
    }
    console.log(`[seed] categories : ${categoriesCreated} would be/was created, ${categoriesUpdated} updated`);
    console.log(`[seed] products   : ${productsCreated} would be/was created, ${productsUpdated} updated`);
    console.log(`[seed] active catalogue after seeding: ${totals.categories} categories / ${totals.products} products`);
    console.log(`[seed] stock_quantity default for NEW rows only: ${DEFAULT_STOCK}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    if (err.code) console.error('[seed] postgres error code:', err.code);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
