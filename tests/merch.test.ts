import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { validPrice } from '../src/lib/price';

test('merch prices distinguish missing/zero and reject invalid currency values', () => {
  for (const value of [null, 0, 750, 12.34]) assert(validPrice(value));
  for (const value of ['', '750', -1, NaN, Infinity, 1.001, 1e12]) assert(!validPrice(value));
});

test('merch migration preserves equipment and prevents duplicate imports; stock edits compare the previous count', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await db.exec(readFileSync('supabase-schema.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/202610180001_inventories.sql','utf8'));
    await db.exec("INSERT INTO boxes(name) VALUES ('Příslušenství'); INSERT INTO items(box_id,name,quantity) VALUES(1,'Zrcadlo','1');");
    const before = (await db.query<Record<string, unknown>>('SELECT * FROM items')).rows[0];
    await db.exec(readFileSync('supabase/migrations/202611130001_merch.sql','utf8'));
    const after = (await db.query<Record<string, unknown>>('SELECT * FROM items')).rows[0];
    for(const key of Object.keys(before)) assert.deepEqual(after[key],before[key]);
    await db.exec("INSERT INTO items(box_id,name,quantity,price,import_key,source_data) VALUES(1,'Triko L','10',600,'sortly:test','{\"quantity\":10}');");
    await assert.rejects(db.exec("INSERT INTO items(box_id,name,import_key) VALUES(1,'Duplicitní','sortly:test')"));
    const first = await db.query("UPDATE items SET quantity='9' WHERE import_key='sortly:test' AND quantity='10' RETURNING id");
    const second = await db.query("UPDATE items SET quantity='8' WHERE import_key='sortly:test' AND quantity='10' RETURNING id");
    assert.equal(first.rows.length,1);
    assert.equal(second.rows.length,0);
    assert.equal((await db.query<{quantity: string}>("SELECT quantity FROM items WHERE import_key='sortly:test'")).rows[0].quantity,'9');
    await assert.rejects(db.exec("UPDATE items SET price=-1 WHERE import_key='sortly:test'"));
    await assert.rejects(db.exec("UPDATE items SET price='NaN' WHERE import_key='sortly:test'"));
  } finally { await db.close(); }
});
