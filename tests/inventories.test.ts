import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { stockStatus, quantityNumber } from '../src/lib/stock';

test('97 in storage + 3 lent: no shortage, recall three; invalid data is unknown', () => {
  assert.deepEqual(
    stockStatus({ quantity: '97', min_quantity: '100', lendings: [{ quantity: '3' }] }),
    { shelf: 97, minimum: 100, lent: 3, total: 100, missing: 0, recall: 3 },
  );
  assert.equal(
    stockStatus({ quantity: '95', min_quantity: '100', lendings: [{ quantity: '3' }] }).missing,
    2,
  );
  assert.equal(
    stockStatus({ quantity: '97', min_quantity: '100', lendings: [{ quantity: 'tři' }] }).missing,
    null,
  );
  for (const value of ['', ' ', '2 balení', '-1', 'Infinity', '0x10', '1e2'])
    assert.equal(quantityNumber(value), null);
  assert.equal(quantityNumber('2,5'), 2.5);
  assert.equal(quantityNumber('0'), 0);
});

test('migration: stock movements, inventory completeness, dated immutable history and permissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;',
    );
    await db.exec(readFileSync('supabase-schema.sql', 'utf8'));
    // Existing shelf count and existing loan must not be changed by migration.
    await db.exec(
      "INSERT INTO boxes(name) VALUES('Vybavení'); INSERT INTO items(box_id,name,quantity,min_quantity) VALUES(1,'Stoly','97','100'); INSERT INTO lendings(item_id,lent_to,quantity) VALUES(1,'Eva','3');",
    );
    await db.exec(readFileSync('supabase/migrations/202610180001_inventories.sql', 'utf8'));
    const scalar = async (sql: string) =>
      Object.values((await db.query(sql)).rows[0] as Record<string, unknown>)[0];
    assert.equal(await scalar('SELECT quantity FROM items WHERE id=1'), '97');
    await db.exec("UPDATE items SET item_type='asset' WHERE id=1;");
    const inventory = await scalar(
      "SELECT start_inventory((now() AT TIME ZONE 'Europe/Prague')::date)",
    );
    assert.equal(inventory, 1);
    await assert.rejects(
      db.exec("SELECT start_inventory((now() AT TIME ZONE 'Europe/Prague')::date)"),
      /duplicate key/,
    );
    await assert.rejects(db.exec('SELECT close_inventory(1)'), /všechny/);
    await assert.rejects(
      db.exec("SELECT check_inventory_item(1,1,-1,(now() AT TIME ZONE \'Europe/Prague\')::date)"),
      /nezáporný/,
    );
    await assert.rejects(
      db.exec("SELECT check_inventory_item(1,1,97,(now() AT TIME ZONE \'Europe/Prague\')::date+1)"),
      /Datum/,
    );
    await db.exec("SELECT check_inventory_item(1,1,97,(now() AT TIME ZONE 'Europe/Prague')::date)");
    assert.equal(
      Number(await scalar('SELECT expected_total FROM inventory_entries WHERE item_id=1')),
      100,
    );
    assert.equal(
      Number(
        await scalar('SELECT counted+lent-expected_total FROM inventory_entries WHERE item_id=1'),
      ),
      0,
    );
    // Re-count keeps the original baseline, even after the live count changed.
    await db.exec("SELECT check_inventory_item(1,1,95,(now() AT TIME ZONE 'Europe/Prague')::date)");
    assert.equal(
      Number(
        await scalar('SELECT counted+lent-expected_total FROM inventory_entries WHERE item_id=1'),
      ),
      -2,
    );
    await assert.rejects(db.exec('DELETE FROM items WHERE id=1'), /uzavření/);
    await db.exec("INSERT INTO items(box_id,name,quantity) VALUES(1,'Páska','2 balení')");
    assert.equal(await scalar('SELECT count(*)::int FROM inventory_entries'), 2);
    await assert.rejects(
      db.exec("SELECT check_inventory_item(1,2,2,(now() AT TIME ZONE 'Europe/Prague')::date)"),
      /typ/,
    );
    await db.exec(
      "UPDATE items SET item_type='consumable' WHERE id=2; SELECT check_inventory_item(1,2,2,(now() AT TIME ZONE \'Europe/Prague\')::date)",
    );
    assert.equal(
      await scalar('SELECT expected_total FROM inventory_entries WHERE item_id=2'),
      null,
    );
    assert.equal(await scalar('SELECT legacy_quantity FROM items WHERE id=2'), '2 balení');
    assert.equal(
      await scalar('SELECT original_quantity FROM inventory_entries WHERE item_id=2'),
      '2 balení',
    );
    await db.exec("SELECT check_inventory_item(1,2,3,(now() AT TIME ZONE 'Europe/Prague')::date)");
    assert.equal(
      await scalar('SELECT legacy_quantity FROM inventory_entries WHERE item_id=2'),
      '2 balení',
    );
    assert.equal(
      await scalar('SELECT original_quantity FROM inventory_entries WHERE item_id=2'),
      '2 balení',
    );
    await db.exec('SELECT close_inventory(1)');
    const before = JSON.stringify(
      (await db.query('SELECT * FROM inventory_entries ORDER BY id')).rows,
    );
    await assert.rejects(
      db.exec("SELECT check_inventory_item(1,1,99,(now() AT TIME ZONE 'Europe/Prague')::date)"),
      /rozpracovaná/,
    );
    await assert.rejects(
      db.exec("UPDATE inventory_entries SET item_name='Changed' WHERE inventory_id=1"),
      /Historii/,
    );
    await assert.rejects(db.exec('DELETE FROM inventories WHERE id=1'), /Uzavřenou/);
    await assert.rejects(
      db.exec(
        "INSERT INTO inventory_entries(inventory_id,item_id,item_name,box_id,box_name,item_type) VALUES(1,999,'Late item',1,'Box','asset')",
      ),
      /Historii/,
    );
    // Return legacy loan restores shelf count once and preserves its history.
    await db.exec('DELETE FROM lendings WHERE id=1');
    assert.equal(await scalar('SELECT quantity FROM items WHERE id=1'), '98');
    await db.exec('DELETE FROM lendings WHERE id=1');
    assert.equal(await scalar('SELECT quantity FROM items WHERE id=1'), '98');
    assert.equal(await scalar('SELECT count(*)::int FROM lending_history'), 1);
    await db.exec("INSERT INTO lendings(item_id,lent_to,quantity) VALUES(1,'Petr','3')");
    assert.equal(await scalar('SELECT quantity FROM items WHERE id=1'), '95');
    await assert.rejects(
      db.exec("INSERT INTO lendings(item_id,lent_to,quantity) VALUES(1,'Petr','999')"),
      /dost kusů/,
    );
    assert.equal(await scalar('SELECT quantity FROM items WHERE id=1'), '95');
    await assert.rejects(db.exec('DELETE FROM items WHERE id=1'), /výpůjčky/);
    await db.exec("DELETE FROM lendings; UPDATE items SET name='Nové jméno'; DELETE FROM items");
    assert.equal(
      JSON.stringify((await db.query('SELECT * FROM inventory_entries ORDER BY id')).rows),
      before,
    );
    await db.exec('SET ROLE anon');
    await assert.rejects(
      db.exec("SELECT start_inventory((now() AT TIME ZONE 'Europe/Prague')::date)"),
      /permission denied/,
    );
    await assert.rejects(db.exec('SELECT * FROM inventory_entries'), /permission denied/);
    await db.exec('RESET ROLE');
  } finally {
    await db.close();
  }
});
