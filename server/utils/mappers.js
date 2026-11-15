'use strict';

/**
 * Helpers that turn database rows into the JSON shapes the frontend uses.
 * Keeping the mapping in one place guarantees that the API always returns
 * a consistent structure.
 */

/** Format a numeric price the same way the frontend always did: "₹45" */
function formatPrice(value) {
  const num = Number(value);
  const rounded = Number.isInteger(num) ? num : Math.round(num * 100) / 100;
  return `₹${rounded}`;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

/** Category row -> API shape */
function mapCategory(row) {
  return {
    id: row.id,
    category_name: row.category_name,
    category_name_ta: row.category_name_ta || null,
    category_slug: row.category_slug,
    description: row.description || null,
    description_ta: row.description_ta || null,
    is_active: row.is_active !== undefined ? row.is_active : true,
    display_order: row.display_order !== undefined ? Number(row.display_order) : 0,
    product_count: row.product_count === undefined ? undefined : Number(row.product_count),
    created_at: row.created_at
  };
}

/** Product row -> API shape */
function mapProduct(row) {
  const price = toNumber(row.price);
  return {
    id: row.id,
    category_id: row.category_id,
    category_slug: row.category_slug || null,
    category_name: row.category_name || null,
    category_name_ta: row.category_name_ta || null,
    product_name: row.product_name,
    product_name_ta: row.product_name_ta || null,
    product_slug: row.product_slug || null,
    description: row.description || null,
    description_ta: row.description_ta || null,
    price,
    price_display: formatPrice(price),
    weight: row.weight || null,
    image_url: row.image_url || null,
    stock_quantity: row.stock_quantity === undefined ? undefined : Number(row.stock_quantity),
    is_available: row.is_available === undefined ? undefined : row.is_available,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/** Cart item row -> API shape (includes the live product data) */
function mapCartItem(row) {
  const unitPrice = toNumber(row.price);
  const quantity = Number(row.quantity);
  return {
    id: row.id,
    product_id: row.product_id,
    quantity,
    unit_price: unitPrice,
    unit_price_display: formatPrice(unitPrice),
    subtotal: toNumber(row.subtotal),
    subtotal_display: formatPrice(toNumber(row.subtotal)),
    product_name: row.product_name,
    product_name_ta: row.product_name_ta || null,
    description: row.description || null,
    description_ta: row.description_ta || null,
    weight: row.weight || null,
    image_url: row.image_url || null,
    stock_quantity: row.stock_quantity === undefined ? undefined : Number(row.stock_quantity),
    is_available: row.is_available === undefined ? undefined : row.is_available,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/** Order row -> API shape */
function mapOrder(row) {
  const total = toNumber(row.total_amount);
  return {
    id: row.id,
    user_id: row.user_id,
    total_amount: total,
    total_amount_display: formatPrice(total),
    order_status: row.order_status,
    customer_name: row.customer_name,
    phone: row.phone,
    delivery_address: row.delivery_address,
    created_at: row.created_at,
    items: row.items ? row.items.map(mapOrderItem) : undefined,
    item_count: row.item_count === undefined ? undefined : Number(row.item_count)
  };
}

/** Order item row -> API shape */
function mapOrderItem(row) {
  const unitPrice = toNumber(row.unit_price);
  const subtotal = toNumber(row.subtotal);
  return {
    id: row.id,
    order_id: row.order_id,
    product_id: row.product_id,
    product_name: row.product_name || null,
    product_name_ta: row.product_name_ta || null,
    image_url: row.image_url || null,
    quantity: Number(row.quantity),
    unit_price: unitPrice,
    unit_price_display: formatPrice(unitPrice),
    subtotal,
    subtotal_display: formatPrice(subtotal)
  };
}

/** User row -> API shape (never exposes the password hash) */
function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
    ...(row.order_count === undefined ? {} : { order_count: Number(row.order_count) })
  };
}

module.exports = {
  formatPrice,
  toNumber,
  mapCategory,
  mapProduct,
  mapCartItem,
  mapOrder,
  mapOrderItem,
  mapUser
};
