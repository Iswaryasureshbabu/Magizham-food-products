'use strict';

/**
 * Cart routes (login required):  /api/cart
 *
 *   GET    /api/cart              - the cart of the signed-in user
 *   POST   /api/cart/items        - add a product (increases the quantity
 *                                   when the product is already in the cart)
 *   PATCH  /api/cart/items/:id    - set a new quantity
 *   DELETE /api/cart/items/:id    - remove a product
 *   POST   /api/cart/sync         - merge the guest cart into the user cart
 *
 * Prices and totals are always calculated from the database - the client
 * never sends an amount.
 */

const express = require('express');
const { z } = require('zod');

const { query, queryOne, transaction } = require('../config/db');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const { ok, created, notFound, conflict, badRequest } = require('../utils/api-response');
const { mapCartItem, toNumber } = require('../utils/mappers');

const router = express.Router();

router.use(requireAuth);

const CART_SELECT = `
  SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
         p.product_name, p.product_name_ta, p.description, p.description_ta,
         p.weight, p.image_url, p.price, p.stock_quantity, p.is_available,
         (ci.quantity * p.price)::numeric(12,2) AS subtotal
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
   WHERE ci.user_id = $1
`;

/** Read the whole cart of a user and calculate the totals. */
async function readCart(userId) {
  const { rows } = await query(`${CART_SELECT} ORDER BY ci.id ASC`, [userId]);

  const items = rows.map(mapCartItem);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + toNumber(item.subtotal), 0);

  return { items, item_count: itemCount, total_amount: totalAmount };
}

/** Fetch a single cart row that belongs to the given user. */
async function findOwnedCartItem(userId, cartItemId) {
  return queryOne(
    `SELECT ci.id, ci.product_id, ci.quantity, p.price, p.stock_quantity,
            (p.is_available AND c.is_active) AS is_available
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN categories c ON c.id = p.category_id
      WHERE ci.id = $1 AND ci.user_id = $2`,
    [cartItemId, userId]
  );
}

const addItemSchema = z.object({
  product_id: z.coerce.number().int().positive('product_id must be a positive number.'),
  quantity: z.coerce.number().int().min(1).max(99).optional().default(1)
});

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99)
});

const syncSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .max(100)
    .optional()
    .default([])
});

/** GET /api/cart */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    return ok(res, await readCart(req.user.id));
  })
);

/** POST /api/cart/items */
router.post(
  '/items',
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const { product_id, quantity } = req.body;

    const product = await queryOne(
      `SELECT p.id, p.price, p.stock_quantity, p.is_available
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = $1 AND c.is_active = TRUE`,
      [product_id]
    );
    if (!product) {
      return notFound(res, 'That product does not exist.');
    }
    if (!product.is_available) {
      return conflict(res, 'This product is currently unavailable.', 'PRODUCT_UNAVAILABLE');
    }

    const existing = await queryOne(
      'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [req.user.id, product_id]
    );
    const newQuantity = (existing ? existing.quantity : 0) + quantity;

    if (newQuantity > product.stock_quantity) {
      return conflict(
        res,
        `Only ${product.stock_quantity} unit(s) of this product are in stock.`,
        'INSUFFICIENT_STOCK'
      );
    }

    // Adding the same product twice increases the quantity instead of
    // creating a second cart row.
    const saved = await queryOne(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
       RETURNING id, product_id, quantity`,
      [req.user.id, product_id, quantity]
    );

    const cart = await readCart(req.user.id);
    return created(res, { item: saved, cart });
  })
);

/** PATCH /api/cart/items/:id */
router.patch(
  '/items/:id',
  validate(updateItemSchema),
  asyncHandler(async (req, res) => {
    const cartItemId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(cartItemId)) {
      return notFound(res, 'Cart item not found.');
    }

    const { quantity } = req.body;
    const item = await findOwnedCartItem(req.user.id, cartItemId);
    if (!item) {
      return notFound(res, 'Cart item not found.');
    }
    if (!item.is_available) {
      return conflict(res, 'This product is currently unavailable.', 'PRODUCT_UNAVAILABLE');
    }
    if (quantity > item.stock_quantity) {
      return conflict(
        res,
        `Only ${item.stock_quantity} unit(s) of this product are in stock.`,
        'INSUFFICIENT_STOCK'
      );
    }

    await query('UPDATE cart_items SET quantity = $2 WHERE id = $1', [cartItemId, quantity]);

    const saved = await queryOne(
      `SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
              p.product_name, p.product_name_ta, p.description, p.description_ta,
              p.weight, p.image_url, p.price, p.stock_quantity, p.is_available,
              (ci.quantity * p.price)::numeric(12,2) AS subtotal
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.id = $1`,
      [cartItemId]
    );

    const cart = await readCart(req.user.id);
    return ok(res, { item: mapCartItem(saved), cart });
  })
);

/** DELETE /api/cart/items/:id */
router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const cartItemId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(cartItemId)) {
      return notFound(res, 'Cart item not found.');
    }

    const item = await findOwnedCartItem(req.user.id, cartItemId);
    if (!item) {
      return notFound(res, 'Cart item not found.');
    }

    await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [cartItemId, req.user.id]);

    const cart = await readCart(req.user.id);
    return ok(res, { removed: cartItemId, cart });
  })
);

/**
 * POST /api/cart/sync
 * Merges a guest cart (localStorage) into the signed-in user's cart.
 * Quantities are added together, products that no longer exist are skipped.
 */
router.post(
  '/sync',
  validate(syncSchema),
  asyncHandler(async (req, res) => {
    const incoming = req.body.items || [];
    if (incoming.length === 0) {
      return ok(res, await readCart(req.user.id));
    }

    await transaction(async (client) => {
      for (const entry of incoming) {
        const product = (
          await client.query(
            `SELECT p.id, p.stock_quantity, p.is_available
               FROM products p JOIN categories c ON c.id = p.category_id
              WHERE p.id = $1 AND c.is_active = TRUE`,
            [entry.product_id]
          )
        ).rows[0];
        if (!product || !product.is_available) continue;

        const current = (
          await client.query(
            'SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2',
            [req.user.id, entry.product_id]
          )
        ).rows[0];

        const wanted = (current ? current.quantity : 0) + entry.quantity;
        const allowed = Math.min(wanted, product.stock_quantity);
        if (allowed < 1) continue;

        await client.query(
          `INSERT INTO cart_items (user_id, product_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, product_id)
           DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
          [req.user.id, entry.product_id, allowed]
        );
      }
    });

    const cart = await readCart(req.user.id);
    return ok(res, cart);
  })
);

/** DELETE /api/cart - empty the cart */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    return ok(res, await readCart(req.user.id));
  })
);

module.exports = router;
module.exports.readCart = readCart;
