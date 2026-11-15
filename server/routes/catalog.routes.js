'use strict';

/**
 * Catalogue routes (public):  /api/categories, /api/products
 *
 *   GET /api/categories
 *   GET /api/categories/:slug/products
 *   GET /api/products?category=masala&search=podi&limit=&offset=
 *   GET /api/products/:id
 */

const express = require('express');
const { z } = require('zod');

const { query } = require('../config/db');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const { ok, notFound } = require('../utils/api-response');
const { mapCategory, mapProduct } = require('../utils/mappers');

const router = express.Router();

const listQuerySchema = z.object({
  category: z.string().trim().toLowerCase().optional(),
  search: z.string().trim().max(120).optional(),
  available: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

const PRODUCT_COLUMNS = `
  p.id, p.category_id, p.product_name, p.product_name_ta, p.product_slug,
  p.description, p.description_ta, p.price, p.weight, p.image_url,
  p.stock_quantity, p.is_available, p.created_at, p.updated_at,
  c.category_slug, c.category_name, c.category_name_ta
`;

/** GET /api/categories - all categories with their product count */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.category_name, c.category_name_ta, c.category_slug,
              c.description, c.description_ta, c.is_active, c.display_order, c.created_at,
              COUNT(p.id) AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
        WHERE c.is_active = TRUE
        GROUP BY c.id
        ORDER BY c.display_order ASC, c.id ASC`
    );
    return ok(res, { categories: rows.map(mapCategory) });
  })
);

/** GET /api/categories/:slug/products - products of one category */
router.get(
  '/categories/:slug/products',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();

    const category = (
      await query(
        `SELECT c.id, c.category_name, c.category_name_ta, c.category_slug,
                c.description, c.description_ta, c.is_active, c.display_order, c.created_at
           FROM categories c
          WHERE c.category_slug = $1 AND c.is_active = TRUE`,
        [slug]
      )
    ).rows[0];

    if (!category) {
      return notFound(res, `No category found for "${slug}".`);
    }

    const { rows } = await query(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p
         JOIN categories c ON c.id = p.category_id
        WHERE p.category_id = $1
        ORDER BY p.id ASC`,
      [category.id]
    );

    return ok(res, {
      category: mapCategory(category),
      products: rows.map(mapProduct)
    });
  })
);

/** GET /api/products - filterable product list */
router.get(
  '/products',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { category, search, available, limit, offset } = req.query;

    const conditions = ['c.is_active = TRUE'];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`c.category_slug = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(p.product_name ILIKE $${params.length} OR p.product_name_ta ILIKE $${params.length} ` +
          `OR p.description ILIKE $${params.length} OR p.description_ta ILIKE $${params.length})`
      );
    }
    if (available) {
      params.push(available === 'true');
      conditions.push(`p.is_available = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = (
      await query(
        `SELECT COUNT(*)::int AS total
           FROM products p
           JOIN categories c ON c.id = p.category_id
           ${where}`,
        params
      )
    ).rows[0];

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${where}
        ORDER BY p.id ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return ok(res, {
      products: rows.map(mapProduct),
      total: countRow.total,
      limit,
      offset
    });
  })
);

/** GET /api/products/:id - a single product */
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return notFound(res, 'Product not found.');
    }

    const row = (
      await query(
        `SELECT ${PRODUCT_COLUMNS}
           FROM products p
           JOIN categories c ON c.id = p.category_id
          WHERE p.id = $1 AND c.is_active = TRUE`,
        [id]
      )
    ).rows[0];

    if (!row) {
      return notFound(res, 'Product not found.');
    }
    return ok(res, { product: mapProduct(row) });
  })
);

module.exports = router;
