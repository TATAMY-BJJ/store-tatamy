// Isolated UI preview / HTTP smoke test. Never reads .env.local or production data.
// The application child receives explicit local-only Supabase configuration.
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, createHmac } from 'node:crypto';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

const db = new PGlite();
const secret = randomBytes(32).toString('hex');
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
await db.exec(readFileSync('supabase-schema.sql', 'utf8'));
await db.exec(
  "ALTER TABLE sections ADD COLUMN color text; INSERT INTO sections(name,color) VALUES('Technika','#1e1e1e'); INSERT INTO boxes(name,section_id) VALUES('Vybavení',1); INSERT INTO items(box_id,name,quantity,min_quantity) VALUES(1,'Stoly','100','100'),(1,'Trička','3x M, 1x XL','4');",
);
await db.exec(readFileSync('supabase/migrations/202610180001_inventories.sql', 'utf8'));
await db.exec(
  "UPDATE items SET item_type='asset' WHERE id=1; UPDATE items SET item_type='consumable' WHERE id=2; INSERT INTO lendings(item_id,lent_to,quantity) VALUES(1,'Testovací výpůjčka','3');",
);

const rpc = {
  start_inventory: ['p_date'],
  check_inventory_item: ['p_inventory', 'p_item', 'p_count', 'p_date'],
  close_inventory: ['p_inventory'],
};
const tables = new Set([
  'inventories',
  'inventory_entries',
  'items',
  'lendings',
  'boxes',
  'sections',
]);
const server = createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  try {
    const url = new URL(request.url, 'http://127.0.0.1:3132');
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const name = url.pathname.split('/').pop();
    let result;
    if (url.pathname.startsWith('/rest/v1/rpc/') && rpc[name] && request.method === 'POST') {
      const args = rpc[name];
      const rows = (
        await db.query(
          `SELECT ${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`,
          args.map((arg) => body[arg]),
        )
      ).rows;
      result = rows[0].result;
    } else if (tables.has(name) && request.method === 'GET') {
      let rows = (await db.query(`SELECT * FROM ${name} ORDER BY id`)).rows;
      for (const column of ['id', 'inventory_id']) {
        const value = url.searchParams.get(column);
        if (value?.startsWith('eq.'))
          rows = rows.filter((row) => String(row[column]) === value.slice(3));
      }
      const allItems = (await db.query('SELECT * FROM items ORDER BY id')).rows;
      const loans = (await db.query('SELECT * FROM lendings ORDER BY id')).rows;
      const boxes = (await db.query('SELECT * FROM boxes ORDER BY id')).rows;
      const sections = (await db.query('SELECT * FROM sections ORDER BY id')).rows;
      const item = (row) => ({
        ...row,
        lendings: loans.filter((l) => l.item_id === row.id),
        box: boxes.find((b) => b.id === row.box_id),
      });
      if (name === 'items') rows = rows.map(item);
      if (name === 'boxes')
        rows = rows.map((row) => ({
          ...row,
          items: allItems.filter((i) => i.box_id === row.id).map(item),
          section: sections.find((s) => s.id === row.section_id),
        }));
      result = request.headers.accept?.includes('vnd.pgrst.object') ? rows[0] : rows;
    } else {
      response.statusCode = 400;
      result = { code: 'PREVIEW_ONLY', message: 'Tato operace není součástí místního náhledu.' };
    }
    // PGlite returns JS Dates; PostgREST returns SQL DATE columns as YYYY-MM-DD.
    // Keep the local adapter faithful to the real API contract.
    const dateColumns = new Set(['inventory_date', 'checked_date', 'last_checked_date']);
    response.end(
      JSON.stringify(result ?? null, (key, value) =>
        dateColumns.has(key) && typeof value === 'string' ? value.slice(0, 10) : value,
      ),
    );
  } catch (error) {
    response.statusCode = 400;
    response.end(JSON.stringify({ code: error.code || 'P0001', message: error.message }));
  }
});
server.listen(3132, '127.0.0.1');
await once(server, 'listening');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3131'],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SUPABASE_SERVER_URL: 'http://127.0.0.1:3132',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3132',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-preview-only',
      SUPABASE_SERVICE_ROLE_KEY: 'local-preview-only',
      SESSION_SECRET: secret,
      ADMIN_PASSWORD_HASH: Buffer.from(bcrypt.hashSync('preview-local', 4)).toString('base64'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);
child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  child.kill();
  server.close();
  await db.close();
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Preview application stopped unexpectedly.');
    try {
      ready = (await fetch('http://127.0.0.1:3131/admin')).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, 'Preview application did not start');
  if (process.argv.includes('--smoke')) {
    const timestamp = Date.now().toString();
    const token = `${timestamp}.${createHmac('sha256', secret).update(timestamp).digest('hex')}`;
    const headers = { 'Content-Type': 'application/json', Cookie: `tatamy_admin_session=${token}` };
    const post = (body) =>
      fetch('http://127.0.0.1:3131/api/inventories', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    assert.equal(
      (await fetch('http://127.0.0.1:3131/api/inventories', { method: 'POST', body: '{}' })).status,
      401,
    );
    assert.equal((await post({ action: 'start', date: '2026-02-30' })).status, 400);
    const started = await post({ action: 'start', date });
    assert.equal(started.status, 200);
    const { id } = await started.json();
    assert.equal((await post({ action: 'close', inventoryId: id })).status, 409);
    for (const [itemId, count] of [
      [1, '97'],
      [2, '4'],
    ]) {
      assert.equal(
        (await post({ action: 'check', inventoryId: id, itemId, count, date })).status,
        200,
      );
    }
    const page = await fetch(`http://127.0.0.1:3131/admin/inventories?id=${id}`, { headers });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert(
      html.includes('3x M, 1x XL'),
      'Original text must appear in the actual server-rendered UI',
    );
    assert(html.includes('Všechny evidované kusy dohledány.'));
    assert.equal((await post({ action: 'close', inventoryId: id })).status, 200);
    assert.equal(
      (await post({ action: 'check', inventoryId: id, itemId: 1, count: '1', date })).status,
      409,
    );
    const alerts = await (await fetch('http://127.0.0.1:3131/admin/alerts', { headers })).text();
    assert(alerts.includes('není potřeba dokupovat'));
    console.log(
      'PASS: actual Next.js HTTP authentication, validation, inventory workflow, history, text preservation and recall UI. Local database only.',
    );
    await stop();
  } else {
    console.log(
      'LOCAL DEMO: http://127.0.0.1:3131/admin — password: preview-local. Synthetic data only; resets on restart.',
    );
  }
} catch (error) {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
}
