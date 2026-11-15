'use strict';

/**
 * Order routes (login required):  /api/orders
 *
 *   POST /api/orders    - place an order (stock is checked and reduced)
 *   GET  /api/orders    - order history of the signed-in user
 *   GET  /api/orders/:id - a single order of the signed-in user
 */

const express = require('express');
const { z } = require('zod');

const { query, queryOne, transaction } = require('../config/db');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');
const { ok, created, notFound, badRequest, conflict } = require('../utils/api-response');
const { mapOrder, mapOrderItem, toNumber } = require('../utils/mappers');

const router = express.Router();

router.use(requireAuth);

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2, 'Please enter your name.').max(150),
  phone: z
    .string()
    .trim()
    .min(6, 'Please enter a valid phone number.')
    .max(20)
    .regex(/^[0-9+\-\s()]{6,20}$/, 'Please enter a valid phone number.'),
  delivery_address: z.string().trim().min(5, 'Please enter a delivery address.').max(1000)
});

/** Load an order with its items. */
async function loadOrder(orderId, userId) {
  const order = await queryOne(
    `SELECT id, user_id, total_amount, order_status, customer_name, phone,
            delivery_address, created_at
       FROM orders
      WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (!order) return null;

  const items = (
    await query(
      `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal,
              p.product_name, p.product_name_ta, p.image_url
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1
        ORDER BY oi.id ASC`,
      [orderId]
    )
  ).rows;

  return { ...order, items };
}

/** POST /api/orders */
router.post(
  '/',
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const { customer_name, phone, delivery_address } = req.body;

    const orderId = await transaction(async (client) => {
      // 1) the cart of the user
      const cartRows = (
        await client.query(
          `SELECT ci.id, ci.product_id, ci.quantity, p.price, p.stock_quantity,
                  (p.is_available AND c.is_active) AS is_available, p.product_name
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             JOIN categories c ON c.id = p.category_id
            WHERE ci.user_id = $1
            ORDER BY ci.id ASC
            FOR UPDATE OF ci`,
          [req.user.id]
        )
      ).rows;

      if (cartRows.length === 0) {
        const err = new Error('Your cart is empty.');
        err.status = 400;
        err.code = 'EMPTY_CART';
        throw err;
      }

      // 2) stock + availability are validated again at checkout time
      let total = 0;
      const lines = [];

      for (const row of cartRows) {
        if (!row.is_available) {
          const err = new Error(`"${row.product_name}" is no longer available.`);
          err.status = 409;
          err.code = 'PRODUCT_UNAVAILABLE';
          throw err;
        }
        if (row.quantity > row.stock_quantity) {
          const err = new Error(
            `Only ${row.stock_quantity} unit(s) of "${row.product_name}" are in stock.`
          );
          err.status = 409;
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }
        const unitPrice = toNumber(row.price);
        const subtotal = unitPrice * row.quantity;
        total += subtotal;
        lines.push({
          productId: row.product_id,
          quantity: row.quantity,
          unitPrice,
          subtotal
        });
      }

      // 3) the order itself
      const order = (
        await client.query(
          `INSERT INTO orders
              (user_id, total_amount, order_status, customer_name, phone, delivery_address)
           VALUES ($1, $2, 'pending', $3, $4, $5)
           RETURNING id`,
          [req.user.id, total, customer_name, phone, delivery_address]
        )
      ).rows[0];

      // 4) the order lines
      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, line.productId, line.quantity, line.unitPrice, line.subtotal]
        );

        // 5) reduce the stock
        const updated = await client.query(
          `UPDATE products
              SET stock_quantity = stock_quantity - $2
            WHERE id = $1 AND stock_quantity >= $2
            RETURNING id`,
          [line.productId, line.quantity]
        );
        if (updated.rowCount === 0) {
          const err = new Error(`"${line.productId}" just went out of stock.`);
          err.status = 409;
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }
      }

      // 6) the cart is emptied after a successful order
      await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

      return order.id;
    });

    const order = await loadOrder(orderId, req.user.id);
    return created(res, { order: mapOrder(order) });
  })
);

/** GET /api/orders */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = (
      await query(
        `SELECT o.id, o.user_id, o.total_amount, o.order_status, o.customer_name,
                o.phone, o.delivery_address, o.created_at,
                COALESCE(SUM(oi.quantity), 0)::int AS item_count
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.user_id = $1
          GROUP BY o.id
          ORDER BY o.created_at DESC, o.id DESC`,
        [req.user.id]
      )
    ).rows;

    // attach the items of every order
    const withItems = await Promise.all(
      orders.map(async (order) => {
        const full = await loadOrder(order.id, req.user.id);
        return mapOrder(full);
      })
    );

    return ok(res, { orders: withItems });
  })
);

/** GET /api/orders/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return notFound(res, 'Order not found.');
    }
    const order = await loadOrder(id, req.user.id);
    if (!order) {
      return notFound(res, 'Order not found.');
    }
    return ok(res, { order: mapOrder(order) });
  })
);

module.exports = router;
module.exports.loadOrder = loadOrder;
