// Offline verification only: no network client, no production credentials.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

async function main() {
  const filename = process.argv[2];
  if (!filename)
    throw new Error('Usage: tsx scripts/verify-snapshot.ts .local/preflight-<timestamp>.json');
  const snapshot = JSON.parse(readFileSync(filename, 'utf8'));
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;',
    );
    await db.exec(readFileSync('supabase-schema.sql', 'utf8'));
    await db.exec('ALTER TABLE sections ADD COLUMN color text');
    for (const table of ['sections', 'boxes', 'items', 'lendings']) {
      // Populate only columns actually present in the reconstructed base schema.
      // Reject drift instead of silently dropping production data.
      const { rows: schema } = await db.query<{ column_name: string }>(
        'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',
        ['public', table],
      );
      const allowed = new Set(schema.map((c) => c.column_name));
      for (const row of snapshot.tables[table]) {
        const columns = Object.keys(row);
        assert(
          columns.every((c) => allowed.has(c)),
          `Unrecognised column in ${table}; update the rehearsal schema.`,
        );
        await db.query(
          `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
          Object.values(row),
        );
      }
      await db.exec(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),coalesce((SELECT max(id) FROM ${table}),1),EXISTS(SELECT 1 FROM ${table}))`,
      );
    }
    await db.exec(readFileSync('supabase/migrations/202610180001_inventories.sql', 'utf8'));
    const { rows: migrated } = await db.query<{
      id: number;
      quantity: string | null;
      note: string | null;
      legacy_quantity: string | null;
    }>('SELECT id,quantity,note,legacy_quantity FROM items');
    let preserved = 0;
    for (const item of migrated) {
      const source = snapshot.tables.items.find((i: { id: number }) => i.id === item.id);
      assert.equal(item.quantity, source.quantity);
      assert.equal(item.note, source.note);
      if (item.quantity && !/^\d+([.,]\d+)?$/.test(item.quantity.trim())) {
        assert.equal(item.legacy_quantity, item.quantity);
        preserved++;
      }
    }
    // Test-only classification and counts: never copied back to production.
    await db.exec(
      "UPDATE items SET item_type='consumable'; SELECT start_inventory((now() AT TIME ZONE 'Europe/Prague')::date)",
    );
    for (const item of migrated) {
      const n =
        item.quantity && /^\d+([.,]\d+)?$/.test(item.quantity.trim())
          ? item.quantity.replace(',', '.')
          : '0';
      await db.query(
        "SELECT check_inventory_item(1,$1,$2::numeric,(now() AT TIME ZONE 'Europe/Prague')::date)",
        [item.id, n],
      );
    }
    await db.exec('SELECT close_inventory(1)');
    const { rows } = await db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM inventory_entries WHERE checked_at IS NOT NULL',
    );
    assert.equal(rows[0].count, migrated.length);
    console.log(
      `PASS: migrated ${migrated.length} real items, preserved ${preserved} text quantities, completed and closed an offline inventory. Production untouched.`,
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
