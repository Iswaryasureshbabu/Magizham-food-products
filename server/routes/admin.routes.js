'use strict';

/**
 * Administration routes (administrator role required):  /api/admin
 *
 *   GET    /api/admin/stats
 *   GET    /api/admin/products
 *   POST   /api/admin/products
 *   PATCH  /api/admin/products/:id
 *   DELETE /api/admin/products/:id
 *   GET    /api/admin/categories
 *   POST   /api/admin/categories
 *   PATCH  /api/admin/categories/:id
 *   DELETE /api/admin/categories/:id
 *   GET    /api/admin/orders
 *   GET    /api/admin/orders/:id
 *   PATCH  /api/admin/orders/:id
 *   GET    /api/admin/users
 *
 * The role check happens on the server - hiding the buttons in the
 * frontend is only a convenience, never the protection.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { z } = require('zod');

const env = require('../config/env');
const { query, queryOne, transaction } = require('../config/db');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const { ok, created, notFound, badRequest, conflict } = require('../utils/api-response');
const { mapProduct, mapCategory, mapOrder, mapUser, toNumber } = require('../utils/mappers');

const router = express.Router();

// Every route below this line requires an administrator session.
router.use(requireAdmin);

const PRODUCT_COLUMNS = `
  p.id, p.category_id, p.product_name, p.product_name_ta, p.product_slug,
  p.description, p.description_ta, p.price, p.weight, p.image_url,
  p.stock_quantity, p.is_available, p.created_at, p.updated_at,
  c.category_slug, c.category_name, c.category_name_ta
`;

/* ------------------------------------------------------------------ */
/*  Dashboard statistics                                              */
/* ------------------------------------------------------------------ */

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const row = await queryOne(`
      SELECT
        (SELECT COUNT(*)::int FROM products)                          AS product_count,
        (SELECT COUNT(*)::int FROM categories)                       AS category_count,
        (SELECT COUNT(*)::int FROM users WHERE role = 'user')         AS customer_count,
        (SELECT COUNT(*)::int FROM orders)                           AS order_count,
        (SELECT COUNT(*)::int FROM orders WHERE order_status = 'pending') AS pending_count,
        (SELECT COALESCE(SUM(total_amount), 0)::numeric(12,2) FROM orders
          WHERE order_status <> 'cancelled')                         AS revenue,
        (SELECT COUNT(*)::int FROM products WHERE stock_quantity <= 5) AS low_stock_count;
    `);

    return ok(res, { stats: row });
  })
);

/* ------------------------------------------------------------------ */
/*  Products                                                          */
/* ------------------------------------------------------------------ */

const productBodySchema = z.object({
  category_id: z.coerce.number().int().positive('Please choose a category.'),
  product_name: z.string().trim().min(2, 'Product name is required.').max(200),
  product_name_ta: z.string().trim().max(200).optional().nullable(),
  product_slug: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  description_ta: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().min(0, 'Price cannot be negative.').max(9999999),
  weight: z.string().trim().max(50).optional().nullable(),
  image_url: z.string().trim().max(500).optional().nullable(),
  stock_quantity: z.coerce.number().int().min(0, 'Stock cannot be negative.').max(1000000),
  is_available: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
});

const productUpdateSchema = productBodySchema.partial();

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Only images that already live in the project's images/ folder are
 * accepted ("images/name.jpg"). This blocks external URLs, javascript: URIs
 * and path traversal, and it makes sure the product never points at a file
 * that does not exist.
 */
const IMAGE_PATH_PATTERN = /^images\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/i;

function imagePathError(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!IMAGE_PATH_PATTERN.test(value) || value.includes('..')) {
    return 'Image path must look like "images/product-name.jpg".';
  }
  if (!fs.existsSync(path.join(env.ROOT_DIR, value))) {
    return `The image file "${value}" does not exist in the images folder.`;
  }
  return null;
}

/** A category can receive products only while it is active. */
async function activeCategoryError(categoryId) {
  const category = await queryOne('SELECT id, is_active FROM categories WHERE id = $1', [categoryId]);
  if (!category) return 'The selected category does not exist.';
  if (!category.is_active) return 'The selected category is not active. Choose an active category.';
  return null;
}

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE p.product_name ILIKE $${params.length} OR p.product_name_ta ILIKE $${params.length}`;
    }

    const rows = (
      await query(
        `SELECT ${PRODUCT_COLUMNS}
           FROM products p
           JOIN categories c ON c.id = p.category_id
           ${where}
          ORDER BY p.id ASC`,
        params
      )
    ).rows;

    return ok(res, { products: rows.map(mapProduct) });
  })
);

router.post(
  '/products',
  validate(productBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body;

    const categoryProblem = await activeCategoryError(body.category_id);
    if (categoryProblem) return badRequest(res, categoryProblem);

    const imageProblem = imagePathError(body.image_url);
    if (imageProblem) return badRequest(res, imageProblem);

    const slug = slugify(body.product_slug || body.product_name);
    if (!slug) {
      return badRequest(res, 'The English product name must contain letters or numbers.');
    }

    try {
      const createdRow = await queryOne(
        `INSERT INTO products
            (category_id, product_name, product_name_ta, product_slug, description,
             description_ta, price, weight, image_url, stock_quantity, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          body.category_id,
          body.product_name,
          body.product_name_ta || null,
          slug,
          body.description || null,
          body.description_ta || null,
          body.price,
          body.weight || null,
          body.image_url || null,
          body.stock_quantity,
          body.is_available
        ]
      );

      const row = (
        await query(
          `SELECT ${PRODUCT_COLUMNS}
             FROM products p JOIN categories c ON c.id = p.category_id
            WHERE p.id = $1`,
          [createdRow.id]
        )
      ).rows[0];

      return created(res, { product: mapProduct(row) });
    } catch (err) {
      if (err.code === '23505') {
        return conflict(res, 'A product with this name already exists in that category.', 'DUPLICATE_SLUG');
      }
      throw err;
    }
  })
);

router.patch(
  '/products/:id',
  validate(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Product not found.');
    }

    const existing = await queryOne('SELECT * FROM products WHERE id = $1', [id]);
    if (!existing) {
      return notFound(res, 'Product not found.');
    }

    const body = req.body;

    // Moving a product into another category requires an active target.
    // (Editing a product that already sits in an inactive category stays possible.)
    if (body.category_id !== undefined && body.category_id !== existing.category_id) {
      const categoryProblem = await activeCategoryError(body.category_id);
      if (categoryProblem) return badRequest(res, categoryProblem);
    }
    if (body.image_url !== undefined && body.image_url !== existing.image_url) {
      const imageProblem = imagePathError(body.image_url);
      if (imageProblem) return badRequest(res, imageProblem);
    }

    const fields = {
      category_id: body.category_id ?? existing.category_id,
      product_name: body.product_name ?? existing.product_name,
      product_name_ta:
        body.product_name_ta === undefined ? existing.product_name_ta : body.product_name_ta || null,
      product_slug: body.product_slug ? slugify(body.product_slug) : existing.product_slug,
      description: body.description === undefined ? existing.description : body.description || null,
      description_ta:
        body.description_ta === undefined ? existing.description_ta : body.description_ta || null,
      price: body.price ?? existing.price,
      weight: body.weight === undefined ? existing.weight : body.weight || null,
      image_url: body.image_url === undefined ? existing.image_url : body.image_url || null,
      stock_quantity: body.stock_quantity ?? existing.stock_quantity,
      is_available: body.is_available === undefined ? existing.is_available : body.is_available
    };

    if (!fields.product_slug) {
      return badRequest(res, 'The English product name must contain letters or numbers.');
    }

    try {
      await query(
        `UPDATE products SET
            category_id     = $2,
            product_name    = $3,
            product_name_ta = $4,
            product_slug    = $5,
            description     = $6,
            description_ta  = $7,
            price           = $8,
            weight          = $9,
            image_url       = $10,
            stock_quantity  = $11,
            is_available    = $12
          WHERE id = $1`,
        [
          id,
          fields.category_id,
          fields.product_name,
          fields.product_name_ta,
          fields.product_slug,
          fields.description,
          fields.description_ta,
          fields.price,
          fields.weight,
          fields.image_url,
          fields.stock_quantity,
          fields.is_available
        ]
      );
    } catch (err) {
      if (err.code === '23503') {
        return badRequest(res, 'The selected category does not exist.');
      }
      if (err.code === '23505') {
        return conflict(res, 'A product with this name already exists in that category.', 'DUPLICATE_SLUG');
      }
      throw err;
    }

    const row = (
      await query(
        `SELECT ${PRODUCT_COLUMNS}
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.id = $1`,
        [id]
      )
    ).rows[0];

    return ok(res, { product: mapProduct(row) });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Product not found.');
    }

    const existing = await queryOne('SELECT id FROM products WHERE id = $1', [id]);
    if (!existing) {
      return notFound(res, 'Product not found.');
    }

    // Products that are part of an order are kept (RESTRICT) so the order
    // history stays intact.
    try {
      await query('DELETE FROM products WHERE id = $1', [id]);
    } catch (err) {
      if (err.code === '23503') {
        return conflict(
          res,
          'This product is part of an existing order and cannot be deleted. Mark it as unavailable instead.',
          'PRODUCT_IN_USE'
        );
      }
      throw err;
    }

    return ok(res, { deleted: id });
  })
);

/* ------------------------------------------------------------------ */
/*  Categories                                                        */
/* ------------------------------------------------------------------ */

const categoryBodySchema = z.object({
  category_name: z.string().trim().min(2, 'Category name is required.').max(150),
  category_slug: z
    .string()
    .trim()
    .min(2)
    .max(150)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, digits and dashes.')
    .optional(),
  category_name_ta: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  description_ta: z.string().trim().max(1000).optional().nullable(),
  is_active: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
    .optional(),
  display_order: z.coerce.number().int().min(0).optional()
});

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const rows = (
      await query(
        `SELECT c.id, c.category_name, c.category_name_ta, c.category_slug,
                c.description, c.description_ta, c.is_active, c.display_order, c.created_at,
                COUNT(p.id) AS product_count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id
          GROUP BY c.id
          ORDER BY c.display_order ASC, c.id ASC`
      )
    ).rows;
    return ok(res, { categories: rows.map(mapCategory) });
  })
);

router.post(
  '/categories',
  validate(categoryBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const slug = slugify(body.category_slug || body.category_name);

    try {
      const createdRow = await queryOne(
        `INSERT INTO categories
            (category_name, category_slug, description, category_name_ta, description_ta, is_active, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          body.category_name,
          slug,
          body.description || null,
          body.category_name_ta || null,
          body.description_ta || null,
          body.is_active !== undefined ? body.is_active : true,
          body.display_order !== undefined ? body.display_order : 0
        ]
      );

      const row = await queryOne(
        `SELECT id, category_name, category_name_ta, category_slug, description,
                description_ta, is_active, display_order, created_at
           FROM categories WHERE id = $1`,
        [createdRow.id]
      );

      return created(res, { category: mapCategory(row) });
    } catch (err) {
      if (err.code === '23505') {
        return conflict(res, 'A category with this slug already exists.', 'DUPLICATE_SLUG');
      }
      throw err;
    }
  })
);

router.patch(
  '/categories/:id',
  validate(categoryBodySchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Category not found.');
    }
    const existing = await queryOne('SELECT * FROM categories WHERE id = $1', [id]);
    if (!existing) {
      return notFound(res, 'Category not found.');
    }

    const body = req.body;
    const values = {
      category_name: body.category_name ?? existing.category_name,
      category_slug: body.category_slug ? slugify(body.category_slug) : existing.category_slug,
      category_name_ta:
        body.category_name_ta === undefined ? existing.category_name_ta : body.category_name_ta || null,
      description: body.description === undefined ? existing.description : body.description || null,
      description_ta:
        body.description_ta === undefined ? existing.description_ta : body.description_ta || null,
      is_active: body.is_active === undefined ? existing.is_active : body.is_active,
      display_order: body.display_order === undefined ? existing.display_order : body.display_order
    };

    try {
      await query(
        `UPDATE categories SET
            category_name    = $2,
            category_slug    = $3,
            category_name_ta = $4,
            description      = $5,
            description_ta   = $6,
            is_active        = $7,
            display_order    = $8
          WHERE id = $1`,
        [id, values.category_name, values.category_slug, values.category_name_ta, values.description, values.description_ta, values.is_active, values.display_order]
      );
    } catch (err) {
      if (err.code === '23505') {
        return conflict(res, 'A category with this slug already exists.', 'DUPLICATE_SLUG');
      }
      throw err;
    }

    const row = await queryOne(
      `SELECT id, category_name, category_name_ta, category_slug, description,
              description_ta, is_active, display_order, created_at
         FROM categories WHERE id = $1`,
      [id]
    );
    return ok(res, { category: mapCategory(row) });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Category not found.');
    }
    const existing = await queryOne('SELECT id FROM categories WHERE id = $1', [id]);
    if (!existing) {
      return notFound(res, 'Category not found.');
    }

    try {
      await query('DELETE FROM categories WHERE id = $1', [id]);
    } catch (err) {
      if (err.code === '23503') {
        return conflict(
          res,
          'This category still contains products. Move or delete them first.',
          'CATEGORY_NOT_EMPTY'
        );
      }
      throw err;
    }

    return ok(res, { deleted: id });
  })
);

/* ------------------------------------------------------------------ */
/*  Orders                                                            */
/* ------------------------------------------------------------------ */

const orderStatusSchema = z.object({
  order_status: z.enum(['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'])
});

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status).trim() : '';
    const params = [];
    let where = '';

    if (status) {
      params.push(status);
      where = `WHERE o.order_status = $${params.length}`;
    }

    const orders = (
      await query(
        `SELECT o.id, o.user_id, o.total_amount, o.order_status, o.customer_name,
                o.phone, o.delivery_address, o.created_at, u.email AS customer_email,
                COALESCE(SUM(oi.quantity), 0)::int AS item_count
           FROM orders o
           JOIN users u ON u.id = o.user_id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           ${where}
          GROUP BY o.id, u.email
          ORDER BY o.created_at DESC, o.id DESC`,
        params
      )
    ).rows;

    const detailed = await Promise.all(
      orders.map(async (order) => {
        const items = (
          await query(
            `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
                    p.product_name, p.product_name_ta, p.image_url
               FROM order_items oi
               JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = $1
              ORDER BY oi.id ASC`,
            [order.id]
          )
        ).rows;
        return { ...mapOrder(order), customer_email: order.customer_email, items };
      })
    );

    return ok(res, { orders: detailed });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Order not found.');
    }
    const order = await queryOne(
      `SELECT o.id, o.user_id, o.total_amount, o.order_status, o.customer_name,
              o.phone, o.delivery_address, o.created_at, u.email AS customer_email
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.id = $1`,
      [id]
    );
    if (!order) {
      return notFound(res, 'Order not found.');
    }
    const items = (
      await query(
        `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
                p.product_name, p.product_name_ta, p.image_url
           FROM order_items oi JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
        [id]
      )
    ).rows;

    return ok(res, { order: { ...mapOrder(order), customer_email: order.customer_email, items } });
  })
);

router.patch(
  '/orders/:id',
  validate(orderStatusSchema),
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Order not found.');
    }
    const { order_status } = req.body;

    // The status is read and changed inside one transaction with the row
    // locked, so two admins cannot restock the same cancelled order twice.
    const outcome = await transaction(async (client) => {
      const order = (
        await client.query('SELECT id, order_status FROM orders WHERE id = $1 FOR UPDATE', [id])
      ).rows[0];
      if (!order) return { missing: true };

      // A cancelled order has already put its stock back; re-opening it would
      // sell stock that is no longer reserved.
      if (order.order_status === 'cancelled' && order_status !== 'cancelled') {
        return { reopen: true };
      }

      // Cancelling an order puts the reserved stock back into the catalogue.
      if (order_status === 'cancelled' && order.order_status !== 'cancelled') {
        const items = (
          await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [id])
        ).rows;
        for (const item of items) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $2 WHERE id = $1',
            [item.product_id, item.quantity]
          );
        }
      }
      await client.query('UPDATE orders SET order_status = $2 WHERE id = $1', [id, order_status]);
      return { ok: true };
    });

    if (outcome.missing) return notFound(res, 'Order not found.');
    if (outcome.reopen) {
      return conflict(
        res,
        'A cancelled order cannot be re-opened. Ask the customer to place a new order.',
        'ORDER_CANCELLED'
      );
    }

    const updated = await queryOne(
      `SELECT o.id, o.user_id, o.total_amount, o.order_status, o.customer_name,
              o.phone, o.delivery_address, o.created_at
         FROM orders o WHERE o.id = $1`,
      [id]
    );
    return ok(res, { order: mapOrder(updated) });
  })
);

/* ------------------------------------------------------------------ */
/*  Users                                                             */
/* ------------------------------------------------------------------ */

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const rows = (
      await query(
        `SELECT u.id, u.name, u.email, u.role, u.created_at,
                COALESCE(o.order_count, 0)::int AS order_count
           FROM users u
           LEFT JOIN (
             SELECT user_id, COUNT(*) AS order_count FROM orders GROUP BY user_id
           ) o ON o.user_id = u.id
          ORDER BY u.id ASC`
      )
    ).rows;
    return ok(res, { users: rows.map(mapUser) });
  })
);

module.exports = router;
module.exports.toNumber = toNumber;
