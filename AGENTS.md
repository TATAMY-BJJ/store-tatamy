# TATAMY Sklad — guidance for maintainers

## Project and boundaries

- Next.js App Router, React, TypeScript, Tailwind, Supabase PostgreSQL.
- Warehouse project: `ozmzjgsxnofxcelrbmpe`. This is separate from the TATAMY fighter database.
- Public pages read stock; admin pages/API routes use the existing signed-cookie login.
- API writes must call `isAuthenticated()` and use the server Supabase client.
- Never print, commit or copy real keys into fixtures. `.env.local` and `.local/` are ignored.
- Keep production migrations separate from local implementation and tests. Verify the target project, backup and rollout plan before production changes.

## Domain invariants

- `items.quantity` = physical stock on the shelf. Active `lendings` are additional owned stock elsewhere.
- 97 on shelf + 3 lent = 100 accounted for. Minimum 100 means recall 3, buy 0.
- Lending/return and shelf-count changes must be atomic. The migration's trigger owns these changes; never repeat the arithmetic in an API or React handler.
- Missing/non-numeric quantity is unknown, never zero. `legacy_quantity` preserves a free-text description and is never parsed into a count.
- Inventory dates are actual checking dates in Europe/Prague; `checked_at` is the separate write timestamp.
- Inventory snapshots survive live item rename, move and deletion. Closed inventory history must not change.
- First check establishes the expected count; correction retains that baseline.
- Existing items remain unclassified until a person chooses asset/consumable. Do not infer types from names in production.

## Main code locations

- `src/lib/stock.ts`: shared stock arithmetic and inventory types.
- `src/app/api/inventories/route.ts`: authenticated request validation and RPC calls.
- `supabase/migrations/202610180001_inventories.sql`: transactional inventory functions, history and lending movements. Applied to production on 2026-10-19; use a new migration for further schema changes. Do not run it again.
- `src/components/InventoriesClient.tsx`: inventory workflow and filtering/pagination.
- `docs/inventories.md`: rollout, verification and operational caveats.

## Validation

1. `npm ci`
2. `npm test` — isolated PostgreSQL behavior tests via PGlite.
3. `npm run lint` and `npm run typecheck`.
4. `npm run build`, then `npm run test:http` — real Next.js endpoints against a local test backend.
5. `npm run test:browser` — Chrome headless, mobile and desktop inventory workflow; screenshots in ignored `.local/qa/`. Requires installed Google Chrome (or set `PLAYWRIGHT_CHANNEL=msedge` for Edge).
6. `npm run preview:local` — interactive inventory demo at http://127.0.0.1:3131/admin, password `preview-local`. Synthetic data only, discarded on exit. The adapter supports inventory read/check/close, not general stock editing.

`npm run db:preflight` is read-only against the configured warehouse project and exports application tables into ignored `.local/`. It is not a full database backup or an atomic snapshot.

`npm run test:snapshot -- .local/preflight-<timestamp>.json` rehearses migration and inventory on that offline export. Test classifications/counts must never be copied back to production.

Do not add preview bypasses to authentication or expose test routes in the deployed application. The preview script supplies explicit local server configuration.
