# Magizham Food Products

Traditional homemade podi, soup, kanji mix, pickle, kulambu and malt varieties.
Static storefront (HTML / CSS / vanilla JS) plus a PostgreSQL backed API for
accounts, carts, orders and catalogue administration.

- Frontend: `index.html`, `category.html`, `cart.html`, `login.html`,
  `register.html`, `checkout.html`, `orders.html`, `admin.html`
- Backend: Express + PostgreSQL (`server/`)
- Languages: English / Tamil (`js/language.js`)

---

## 1. Requirements

| Tool | Version used | Notes |
|------|--------------|-------|
| Node.js | 18+ (tested on 24) | `node -v` |
| PostgreSQL | 14+ (tested on 18.6) | running on `127.0.0.1:5432` |
| psql | optional | only for the SQL variant of the bootstrap |

```bash
npm install
```

---

## 2. One-time database setup

The bootstrap creates **only** the login role and the application database.
It never drops anything and it is safe to run again.

### Option A - Node helper (recommended, writes `.env` for you)

```powershell
$env:PGPASSWORD = "your-postgres-superuser-password"
npm run db:bootstrap
```

The script writes `.env` with `DATABASE_URL`, a generated `SESSION_SECRET`,
`PORT=5000` and `CORS_ORIGIN`. `.env` is git-ignored - never commit it.

### Option B - plain SQL (no Node helper)

```powershell
$env:PGPASSWORD = "your-postgres-superuser-password"
psql -U postgres -d postgres `
     -v app_password="YOUR_APP_ROLE_PASSWORD" `
     -v app_db=magizham_db `
     -v app_user=magizham_app `
     -f server/db/bootstrap.sql
```

Then copy `.env.example` to `.env` and fill in the same role password:

```
DATABASE_URL=postgresql://magizham_app:YOUR_APP_ROLE_PASSWORD@127.0.0.1:5432/magizham_db
SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

### Then create the schema and import the catalogue

```bash
npm run db:migrate      # creates the tables (idempotent, never drops data)
npm run db:seed         # imports the 54 products / 6 categories from js/products.js
```

### Updating a database that already has data (read this first)

Your database was seeded earlier with an older 41-product catalogue whose ids
`1..41` belong to different products. The seed is built so it can never damage
that data:

```bash
npm run db:migrate                 # adds categories.is_active / display_order if missing (safe, idempotent)
npm run db:seed -- --dry-run       # shows what WOULD happen and writes nothing
```

* If the dry run ends with `STOPPED: n product id collision(s)`, **nothing was
  written**. Each collision line names a product id that the new catalogue wants
  but an older product already uses. Send that list to whoever maintains the
  project (or decide for each row) before seeding for real - ids are never
  reassigned silently.
* If the dry run is clean, run `npm run db:seed`. It runs in one transaction, keeps
  existing ids and **stock quantities**, updates renamed pickles in place, adds the
  ten new 200g pickle rows (ids 45-54) and **deactivates** (never deletes) any
  category that is not on the pamphlet. Order history and carts are untouched.
* Take a backup first: `pg_dump -U postgres magizham_db > backup.sql` (keep the
  file private - it contains customer data and must never be committed or shared).

`npm run db:reset` is blocked unless you deliberately set `ALLOW_DB_RESET=yes`
for that one command, because it deletes every table including orders. Never use
it on a live shop.

### Create the first administrator

```bash
npm run admin:create
```

You are prompted for e-mail / password, or use `ADMIN_EMAIL` /
`ADMIN_PASSWORD` from `.env`. The account gets the `admin` role and can open
`admin.html`.

### Optional: check the connection

```bash
npm run db:test
```

---

## 3. Run the application

```bash
npm run server     # Express API + static site on http://localhost:5000
npm run dev        # frontend only, live reload on http://localhost:5501
```

`npm run server` serves the whole site, so `http://localhost:5000` is enough
for a full test. Use `npm run dev` when you want live reload while editing the
frontend; the API stays on port 5000. In development, `CORS_ORIGIN` is extended
automatically to allow `localhost`, `127.0.0.1` and `[::1]` on any port, so
Live Server can fall back to another port when 5501 is busy. Production only
allows the exact origins listed in `CORS_ORIGIN`.

---

## 4. How the pieces fit together

```
js/api.js      MagizhamAPI      - fetch wrapper, probes the API base URL
js/ui.js       MagizhamUI       - escaping, toasts, image/price helpers, forms
js/auth.js     MagizhamAuth     - session state, requireLogin(), header menu
js/catalog.js  MagizhamCatalog  - loads /products from the API into globals
js/cart.js                     - guest cart (localStorage) + server cart
js/category.js                 - category page rendering from the catalogue
js/language.js                 - English / Tamil dictionary (data-key driven)
js/login.js js/register.js js/checkout.js js/orders.js js/admin.js
```

- The catalogue is loaded from the database on every page and stored in the
  global `products` / `allProducts` objects (same shape as `js/products.js`),
  so the existing markup keeps working.
- Images are resolved through `MagizhamUI.imageSrc()` - the database stores
  `images/<file>`, the bundled data stores bare file names.
- Guests keep their cart in `localStorage` (`magizhamCart`). As soon as a user
  logs in, the guest cart is pushed to the server and the session cart is used
  from then on.
- All user supplied text is inserted with `MagizhamUI.escapeHtml()`.

---

## 5. API overview

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | - | health check |
| GET | `/api/products` | - | products (+ optional `?search=`, `?category=`, `?limit=`, `?offset=`) |
| GET | `/api/products/:id` | - | one product |
| GET | `/api/categories` | - | categories with product counts |
| GET | `/api/categories/:slug/products` | - | products of one category |
| POST | `/api/auth/register` | - | create an account |
| POST | `/api/auth/login` | - | start a session |
| POST | `/api/auth/logout` | - | end the session |
| GET | `/api/auth/me` | cookie | current user |
| GET | `/api/cart` | cookie | session cart |
| POST | `/api/cart/items` | cookie | add a product |
| PATCH | `/api/cart/items/:id` | cookie | change the quantity |
| DELETE | `/api/cart/items/:id` | cookie | remove a line |
| DELETE | `/api/cart` | cookie | empty the cart |
| POST | `/api/cart/sync` | cookie | merge the guest cart |
| GET | `/api/orders` | cookie | own orders |
| POST | `/api/orders` | cookie | place an order |
| GET | `/api/orders/:id` | cookie | one order |
| GET | `/api/admin/stats` | admin | counters |
| GET/POST/PATCH/DELETE | `/api/admin/products`, `/api/admin/categories` | admin | catalogue CRUD |
| GET | `/api/admin/orders` | admin | all orders (optional `?status=`) |
| PATCH | `/api/admin/orders/:id` | admin | order status (`{ order_status }`) |
| GET | `/api/admin/users` | admin | customer list |

There is no data route at `/api` itself (it returns a 404); use one of the
endpoints above, for example `http://localhost:5000/api/products`.

Auth uses a `httpOnly` session cookie; the API answers with
`{ success: true, data: ... }` and errors with
`{ success: false, error: { code, message, details } }`.

---

## 6. Environment variables

See `.env.example` for the full list. The only mandatory values are
`DATABASE_URL` and `SESSION_SECRET`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | API / static server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `SESSION_SECRET` | - | signs the session cookie |
| `CORS_ORIGIN` | localhost 5501/5173 | comma separated allowed origins |
| `SESSION_MAX_AGE` | `604800000` | cookie lifetime in ms |
| `BCRYPT_ROUNDS` | `12` | password hashing cost |
| `COOKIE_SECURE` | `false` | set `true` when served over HTTPS |
| `CORS_ALLOW_ALL` | `false` | local testing convenience only |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | - | used by `npm run admin:create` |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `password authentication failed for user "postgres"` | the superuser password in `PGPASSWORD` is wrong |
| `database "magizham_db" does not exist` | run the bootstrap (step 2) |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running / wrong `PGPORT` |
| `relation "products" does not exist` | run `npm run db:migrate` |
| Products show but the badge stays empty | API not reachable - check `npm run db:test` and the browser console |
| Login returns 401 | `.env` missing `SESSION_SECRET`, or the cookie was blocked |
| Admin tab missing | the account has no `admin` role - create it with `npm run admin:create` |


---

## 8. Catalogue (source: the Tamil pamphlet)

Six active categories: Podi Varieties (23), Soup Varieties (2), Kanji Mix (4),
Pickle Varieties (20), Kulambu Varieties (2), Malt Varieties (3) = **54 products**.

* The pamphlet has 44 entries. The pickle table lists two pack sizes per pickle, so
  each pickle is stored as **two products** - "Tomato Pickle (100g)" at 60 and
  "Tomato Pickle (200g)" at 120. The 100g rows keep ids 30-39; the 200g rows are
  ids 45-54. There is no variants table. (Inside the Pickles page the 100g rows
  list first, then the 200g rows, because products are ordered by id.)
* Product descriptions are **blank** on purpose: the earlier text was not from the
  pamphlet and contained health claims. Add real descriptions in the admin
  dashboard when you have them.
* Pamphlet spelling is kept exactly. Item 14 is printed "குழம்பு **மிலகாய்** தூள்";
  the usual spelling is மிளகாய். If that is a typo on the pamphlet, correct it in
  the admin dashboard (or in `js/products.js` and re-seed).
* 65 Masala is ₹25 on the pamphlet (other podi are 45-75). It is kept as printed.
* Images: products without a real photo use `images/placeholder-product.png`
  (a neutral logo tile) instead of a misleading picture. Several products share one
  generic photo of a similar item (for example all four kanji use one bowl). Replace
  them with real product photos through the admin dashboard (image path field).
* Unused legacy files remain in `images/` (masala/millets/snacks/readymix banners
  and cards). They are no longer referenced and can be deleted when you are sure.

## 9. Design and languages

* Palette tokens live at the top of `css/style.css` (Palm Green `#2E5B38`,
  Backwater Emerald `#123F32`, Turmeric `#F4B41A`, Warm Cream `#FAF7F2`, ...).
  Older variable names (`--green`, `--yellow`, ...) point at them.
* Language choice is stored in `localStorage` (`magizhamLang`) and sets
  `<html lang>` (`en` / `ta`). Tamil uses Noto Sans Tamil first.
* Font Awesome icons and Google Fonts load from CDNs: the site needs internet for
  icons and fonts.

## 10. Tests

```bash
npm test          # 20 tests, no database needed (catalogue vs pamphlet, seed logic, API guards)
npm run test:ui   # optional: needs `pip install playwright` and `playwright install chromium`
```

* `tests/catalogue.test.js` - names, packs, prices, ids, images against the pamphlet.
* `tests/seed-logic.test.js` - idempotency, dry run, id-collision stop, renamed rows keep id and stock
  (runs against an in-memory stand-in for PostgreSQL).
* `tests/api-guards.test.js` - login/role guards, no self-made admins, inactive-category and image-path
  validation, order-status/stock safety (real Express app, stand-in database).
* `tests/ui_smoke.py` - 12 pages x 4 widths x 2 languages: JS errors, sideways scrolling,
  broken images, uneven card widths.
* `npm run db:test` checks the real PostgreSQL connection (needs your `.env`).

## 11. Known limitations

* The automated tests do **not** touch a real PostgreSQL server: run `npm run db:test`,
  the dry-run seed and a manual admin/checkout walk-through on your machine.
* Admin image handling accepts **paths to files already in `images/`**; uploading
  new image files from the browser is not implemented (copy the file into `images/`).
* Tamil glyph rendering was checked structurally (no overflow), not visually, in
  the test environment; look at the Tamil pages on a real device.
* Category pages show no descriptive sentence until you provide verified text (the old sentences were not from the pamphlet and included medicinal claims).
* Checkout has no online payment gateway.
