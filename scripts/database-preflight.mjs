// Read-only application-data export. This is NOT a full database backup.
// Run: node --env-file=.env.local scripts/database-preflight.mjs
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
const expectedHost = 'ozmzjgsxnofxcelrbmpe.supabase.co';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || new URL(url).hostname !== expectedHost || !key) {
  throw new Error('Verify the warehouse project URL and server key in .env.local.');
}
const db = createClient(url, key, { auth: { persistSession: false } });
const snapshot = { project: expectedHost, exportedAt: new Date().toISOString(), tables: {} };
for (const table of ['sections', 'boxes', 'items', 'lendings']) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order('id')
      .range(offset, offset + 499);
    if (error) throw new Error(`Cannot export ${table}: ${error.code}`);
    rows.push(...data);
    if (data.length < 500) break;
  }
  snapshot.tables[table] = rows;
}
await mkdir('.local', { recursive: true });
const filename = `.local/preflight-${Date.now()}.json`;
await writeFile(filename, JSON.stringify(snapshot, null, 2), { flag: 'wx' });
console.log(
  JSON.stringify({
    file: filename,
    counts: Object.fromEntries(
      Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length]),
    ),
  }),
);
