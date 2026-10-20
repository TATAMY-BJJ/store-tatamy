'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Item } from '@/lib/types';
import { todayPrague, type Inventory, type InventoryEntry } from '@/lib/stock';

const field =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 min-h-11 focus:outline-none focus:ring-2 focus:ring-tatamy-red';
const button =
  'rounded-lg bg-tatamy-black text-white px-4 py-3 min-h-11 font-medium hover:bg-gray-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2';
const dateLabel = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('cs-CZ');

export default function InventoriesClient({
  inventories,
  selected,
  entries,
  items,
  initialBox,
}: {
  inventories: Inventory[];
  selected: Inventory | null;
  entries: InventoryEntry[];
  items: Item[];
  initialBox: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayPrague());
  const [filter, setFilter] = useState('all');
  const [box, setBox] = useState(initialBox);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const open = selected?.status === 'open';
  const checked = entries.filter((e) => e.checked_at).length;
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/inventories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (body.action === 'start') router.push(`/admin/inventories?id=${data.id}`);
      setNotice(body.action === 'close' ? 'Inventura uzavřena a uložená do historie.' : 'Uloženo.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spojení selhalo. Zkuste to znovu.');
    } finally {
      setBusy(false);
    }
  }
  const visible = entries.filter(
    (e) =>
      (!box || String(e.box_id) === box) &&
      (!search ||
        `${e.item_name} ${e.box_name}`
          .toLocaleLowerCase('cs')
          .includes(search.toLocaleLowerCase('cs'))) &&
      (filter === 'all' ||
        (filter === 'pending' && !e.checked_at) ||
        (filter === 'differences' &&
          e.checked_at &&
          e.expected_total !== null &&
          Number(e.counted) + Number(e.lent) !== Number(e.expected_total))),
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventury</h1>
        <p className="mt-2 text-gray-600">
          Skutečný stav skladu podle data kontroly. Půjčené kusy zůstávají součástí evidovaného
          majetku.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 bg-white p-4 rounded-xl">
        <label className="space-y-2">
          Historie inventur
          <select
            className={field}
            value={selected?.id || ''}
            onChange={(e) => router.push(`/admin/inventories?id=${e.target.value}`)}
          >
            <option value="" disabled>
              Vyberte inventuru
            </option>
            {inventories.map((i) => (
              <option key={i.id} value={i.id}>
                {dateLabel(i.inventory_date)} — {i.status === 'open' ? 'Rozpracovaná' : 'Uzavřená'}
              </option>
            ))}
          </select>
        </label>
        {!inventories.some((i) => i.status === 'open') ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ action: 'start', date });
            }}
          >
            <label className="flex-1 space-y-2">
              Datum zahájení kontroly
              <input
                className={field}
                type="date"
                required
                max={todayPrague()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button className={button} disabled={busy}>
              Zahájit inventuru
            </button>
          </form>
        ) : (
          <p className="self-center text-gray-600">
            Nejprve dokončete rozpracovanou inventuru. Každá položka má vlastní datum přepočítání.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 text-red-800 p-4">
          {error}
        </p>
      )}
      <p role="status" className="text-green-800">
        {notice}
      </p>
      {selected && (
        <>
          <section className="bg-white rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Inventura {dateLabel(selected.inventory_date)}
              </h2>
              <span>{open ? 'Rozpracovaná' : 'Uzavřená'}</span>
            </div>
            <p>
              Zkontrolováno{' '}
              <strong>
                {checked} z {entries.length}
              </strong>{' '}
              položek
            </p>
            <progress
              className="w-full accent-tatamy-red"
              value={checked}
              max={entries.length || 1}
              aria-label="Dokončenost inventury"
            />
            <p className="text-sm text-gray-600">
              Počet je stav fyzicky ve skladu. Výpůjčky se přičtou automaticky. Nezměněný počet také
              potvrďte.
            </p>
            {open && (
              <button
                className={button}
                disabled={busy || checked !== entries.length || !entries.length}
                onClick={() => {
                  if (confirm('Uzavřít inventuru? Uloženou historii už nebude možné měnit.'))
                    void act({ action: 'close', inventoryId: selected.id });
                }}
              >
                Uzavřít inventuru
              </button>
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              Hledat položku
              <input
                className={field}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Krabice
              <select
                className={field}
                value={box}
                onChange={(e) => {
                  setBox(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Všechny krabice</option>
                {Array.from(new Map(entries.map((e) => [e.box_id, e.box_name]))).map(
                  ([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Zobrazit
              <select
                className={field}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Všechny položky</option>
                <option value="pending">Nezkontrolované</option>
                <option value="differences">Rozdíly</option>
              </select>
            </label>
          </div>
          <nav aria-label="Stránky položek" className="flex flex-wrap items-center gap-3">
            <button
              className={button}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Předchozí
            </button>
            <span>
              Strana {currentPage + 1} z {pageCount} · {visible.length} položek
            </span>
            <button
              className={button}
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Další
            </button>
          </nav>
          {!visible.length && (
            <p className="p-6 bg-white rounded-xl">Žádné položky pro tento výběr.</p>
          )}
          {visible.slice(currentPage * 25, (currentPage + 1) * 25).map((entry) => (
            <Entry
              key={`${entry.id}-${entry.checked_at}`}
              entry={entry}
              item={items.find((i) => i.id === entry.item_id)}
              open={!!open}
              busy={busy}
              startDate={selected.inventory_date}
              save={(count, date) =>
                act({
                  action: 'check',
                  inventoryId: selected.id,
                  itemId: entry.item_id,
                  count,
                  date,
                })
              }
            />
          ))}
        </>
      )}
    </main>
  );
}

function Entry({
  entry: e,
  item,
  open,
  busy,
  startDate,
  save,
}: {
  entry: InventoryEntry;
  item?: Item;
  open: boolean;
  busy: boolean;
  startDate: string;
  save: (count: string, date: string) => Promise<void>;
}) {
  const [count, setCount] = useState(e.counted === null ? '' : String(e.counted));
  const [date, setDate] = useState(e.checked_date || todayPrague());
  const delta =
    e.checked_at && e.expected_total !== null
      ? Number(e.counted) + Number(e.lent) - Number(e.expected_total)
      : null;
  const type = item?.item_type || e.item_type;
  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-semibold text-lg">{e.item_name}</h3>
          <p className="text-sm text-gray-600">
            {e.box_name} ·{' '}
            {type === 'asset'
              ? 'Dlouhodobý majetek'
              : type === 'consumable'
                ? 'Spotřební materiál'
                : 'Neurčený typ'}
          </p>
        </div>
        <span className={e.checked_at ? 'text-green-800' : 'text-amber-800'}>
          {e.checked_date ? `Zkontrolováno ${dateLabel(e.checked_date)}` : 'Čeká na kontrolu'}
        </span>
      </div>
      {(e.legacy_quantity || item?.legacy_quantity) && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          Původní text množství (pro informaci): {e.legacy_quantity || item?.legacy_quantity}. Do
          počtu se automaticky nezapočítává.
        </p>
      )}
      {e.checked_at && (
        <div className="space-y-1">
          <p>
            Ve skladu: <strong>{e.counted}</strong> · Půjčeno: <strong>{e.lent}</strong> · Celkem:{' '}
            <strong>{Number(e.counted) + Number(e.lent)}</strong> · Minimum:{' '}
            {e.minimum ?? 'nenastaveno'}
          </p>
          <p
            className={
              delta !== null && delta < 0 && type === 'asset'
                ? 'text-red-800 font-semibold'
                : 'text-gray-700'
            }
          >
            {delta === null
              ? 'Výchozí stav založen; původní počet nebyl číselný.'
              : delta === 0
                ? 'Všechny evidované kusy dohledány.'
                : `${type === 'asset' && delta < 0 ? 'Chybějící majetek' : 'Rozdíl'}: ${delta > 0 ? '+' : ''}${delta} oproti evidovaným ${e.expected_total}.`}
          </p>
          {e.lending_snapshot?.map((l, i) => (
            <p key={i} className="text-sm text-gray-600">
              Půjčeno: {l.lent_to} — {l.quantity}
            </p>
          ))}
        </div>
      )}
      {open && (
        <>
          <Link
            className="inline-block underline py-2"
            href={`/admin/box/${item?.box_id || e.box_id}`}
          >
            Upravit položku / typ / výpůjčky
          </Link>
          <p className="text-sm text-gray-600">
            Nyní evidováno ve skladu: {item?.quantity ?? 'neurčeno'}
            {item?.lendings?.map((l) => ` · ${l.lent_to}: ${l.quantity} půjčeno`).join('')}
          </p>
          <form
            className="grid gap-3 sm:grid-cols-3 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void save(count, date);
            }}
          >
            <label>
              Napočítáno ve skladu
              <input
                required
                className={field}
                inputMode="decimal"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
            <label>
              Datum přepočítání
              <input
                required
                className={field}
                type="date"
                min={startDate}
                max={todayPrague()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <button className={button} disabled={busy || type === 'unclassified' || !item}>
              {e.checked_at ? 'Opravit přepočítání' : 'Potvrdit přepočítání'}
            </button>
          </form>
          {type === 'unclassified' && (
            <p className="text-amber-800">Před kontrolou vyberte v editaci položky její typ.</p>
          )}
        </>
      )}
    </article>
  );
}
