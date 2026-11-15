# Renewal changelog

## Catalogue
- 6 pamphlet categories, 54 products (44 pamphlet entries + 10 extra 200g pickle rows, ids 45-54). Original ids 1-44 kept.
- Descriptions and category banner sentences blanked (unverified; contained health/medicinal claims).
- Pamphlet spelling kept (item 14 "மிலகாய்" - flagged in README). Podi category Tamil name = "பொடி வகைகள்".
- Neutral placeholder image replaces 9 flat colour tiles (25 products).

## Database
- schema.sql already contains categories.is_active / display_order (idempotent ALTERs) - run `npm run db:migrate`.
- seed.js: single transaction, `--dry-run`, never reassigns ids (reports collisions and writes nothing), keeps stock, deactivates (never deletes) obsolete categories.
- migrate.js: `--force` (db:reset) now refuses unless ALLOW_DB_RESET=yes.

## Server
- Admin: product create/move needs an ACTIVE category; image path must be images/<existing file>; empty slug -> 400; order status change is transactional and a cancelled order cannot be re-opened (stock safety).
- Public product-by-id, cart add/sync/update and checkout ignore products in inactive categories.

## Frontend
- Palette tokens (Palm Green, Backwater Emerald, Turmeric, Warm Cream, ...); Stitch-inspired card/header/footer refinements; focus styles; reduced-motion; 1360px max width.
- FIXED: homepage category cards, all footers and "Continue Shopping" linked to removed categories.
- FIXED: grid items shrank to their text (uneven card widths).
- Category cards 3x2 / 2x3. Product images: cover with focal point, placeholder contained, equal card layout.
- Tamil: `<html lang>` set on every switch, Noto Sans Tamil first, wrapping rules. Stale marketing copy (millets/snacks/ready mix) replaced; Tamil footer/meta = verbatim pamphlet tagline.
- Admin: category dropdown lists active categories only.

## Tests (npm test = 20 tests; npm run test:ui = 384 checks)
