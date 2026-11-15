-- =============================================================
--  Magizham Food Products - PostgreSQL schema
--  Database: magizham_db
--
--  Apply with:  npm run db:migrate   (node server/db/migrate.js)
--
--  The script is idempotent: it can safely be run on an existing
--  database without dropping data.
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
--  users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT        NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_role_check   CHECK (role IN ('user', 'admin')),
    CONSTRAINT users_name_check   CHECK (length(trim(name)) > 0),
    CONSTRAINT users_email_lower  CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------------------------------------------------------------
--  categories
--  *_ta columns hold the Tamil name / description used by the
--  existing language switcher (js/language.js).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id              SERIAL PRIMARY KEY,
    category_name   VARCHAR(150) NOT NULL,
    category_slug   VARCHAR(150) NOT NULL,
    description     TEXT,
    category_name_ta VARCHAR(150),
    description_ta  TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    display_order   INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT categories_slug_unique UNIQUE (category_slug),
    CONSTRAINT categories_name_check CHECK (length(trim(category_name)) > 0),
    CONSTRAINT categories_slug_check CHECK (category_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------
--  products
--  product_slug + (category_id) gives a stable natural key so the
--  seed script can be re-run without creating duplicates.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER      NOT NULL,
    product_name    VARCHAR(200) NOT NULL,
    product_slug    VARCHAR(200) NOT NULL,
    description     TEXT,
    description_ta  TEXT,
    product_name_ta VARCHAR(200),
    price           NUMERIC(10,2) NOT NULL,
    weight          VARCHAR(50),
    image_url       TEXT,
    stock_quantity  INTEGER      NOT NULL DEFAULT 0,
    is_available    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT products_category_fk FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT products_price_check     CHECK (price >= 0),
    CONSTRAINT products_stock_check     CHECK (stock_quantity >= 0),
    CONSTRAINT products_name_check      CHECK (length(trim(product_name)) > 0),
    CONSTRAINT products_slug_check      CHECK (product_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT products_category_slug_unique UNIQUE (category_id, product_slug)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products (is_available);

-- ---------------------------------------------------------------
--  cart_items
--  UNIQUE (user_id, product_id) guarantees that adding the same
--  product twice updates the quantity instead of creating a row.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cart_items_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT cart_items_product_fk FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT cart_items_unique UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items (user_id);

-- ---------------------------------------------------------------
--  orders
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER       NOT NULL,
    total_amount     NUMERIC(10,2) NOT NULL,
    order_status     VARCHAR(30)   NOT NULL DEFAULT 'pending',
    customer_name    VARCHAR(150)  NOT NULL,
    phone            VARCHAR(20)   NOT NULL,
    delivery_address TEXT          NOT NULL,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_user_fk FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT orders_total_check CHECK (total_amount >= 0),
    CONSTRAINT orders_status_check CHECK (order_status IN
        ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT orders_name_check  CHECK (length(trim(customer_name)) > 0),
    CONSTRAINT orders_address_check CHECK (length(trim(delivery_address)) > 0),
    CONSTRAINT orders_phone_check CHECK (length(trim(phone)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (order_status);

-- ---------------------------------------------------------------
--  order_items
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INTEGER       NOT NULL,
    product_id INTEGER       NOT NULL,
    quantity   INTEGER       NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    subtotal   NUMERIC(10,2) NOT NULL,

    CONSTRAINT order_items_order_fk FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT order_items_product_fk FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT order_items_quantity_check   CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT order_items_subtotal_check   CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- ---------------------------------------------------------------
--  keep products.updated_at fresh automatically
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- =============================================================
--  Verification queries (run after migrating)
-- =============================================================
--  SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
--  SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--   WHERE conrelid IN ('users'::regclass, 'categories'::regclass,
--                       'products'::regclass, 'cart_items'::regclass,
--                       'orders'::regclass, 'order_items'::regclass)
--   ORDER BY conrelid::text, conname;
