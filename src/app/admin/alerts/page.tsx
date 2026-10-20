import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { stockStatus } from '@/lib/stock';
import Header from '@/components/Header';
import Link from 'next/link';

export const revalidate = 0;

export default async function AdminAlertsPage() {
  if (!(await isAuthenticated())) redirect('/admin');
  const { data: items, error } = await supabase
    .from('items')
    .select('*, box:boxes(id, name), lendings(*)')
    .not('min_quantity', 'is', null);
  if (error) throw new Error('Nepodařilo se načíst stav zásob.');
  const rows = (items || []).map((item) => ({ item, state: stockStatus(item) }));
  const missing = rows.filter((r) => r.state.missing !== null && r.state.missing > 0);
  const recall = rows.filter((r) => r.state.recall !== null && r.state.recall > 0);
  const unknown = rows.filter((r) => r.state.total === null || r.state.minimum === null);
  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin showBackButton backHref="/admin/dashboard" backLabel="Sklad" />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Zásoby a výpůjčky</h1>
        <p className="text-gray-600">
          Minimum se porovnává se součtem kusů ve skladu a evidovaných výpůjček.
        </p>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Pod minimem · {missing.length}</h2>
          {!missing.length && (
            <p className="bg-white p-4 rounded-xl">
              Žádná z vyhodnotitelných položek není pod minimem.
            </p>
          )}
          {missing.map(({ item, state }) => (
            <div key={item.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
              <Link className="font-semibold underline" href={`/admin/box/${item.box_id}`}>
                {item.name} · {item.box?.name}
              </Link>
              <p className="mt-2">
                Ve skladu {state.shelf} + půjčeno {state.lent} = celkem {state.total}. Minimum{' '}
                {state.minimum}.
              </p>
              <p className="font-semibold text-red-800">Doplnit {state.missing}.</p>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Vyžádat zpět před turnajem · {recall.length}</h2>
          {!recall.length && (
            <p className="bg-white p-4 rounded-xl">
              Pro dosažení minim není potřeba stahovat výpůjčky.
            </p>
          )}
          {recall.map(({ item, state }) => (
            <div key={item.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Link className="font-semibold underline" href={`/admin/box/${item.box_id}`}>
                {item.name} · {item.box?.name}
              </Link>
              <p className="mt-2">
                Vyžádat zpět {state.recall}.{' '}
                {state.missing === 0
                  ? 'Majetek je dohledaný, není potřeba dokupovat.'
                  : `Navíc doplnit ${state.missing}.`}
              </p>
              {(item.lendings as { id: number; lent_to: string; quantity: string }[]).map((l) => (
                <p key={l.id}>
                  {l.lent_to}: {l.quantity}
                </p>
              ))}
            </div>
          ))}
        </section>
        {!!unknown.length && (
          <section className="bg-white p-4 rounded-xl">
            <h2 className="text-xl font-semibold">Nelze vyhodnotit · {unknown.length}</h2>
            <p>
              Opravte nečíselné množství nebo minimum. Tyto položky nejsou označené jako v pořádku.
            </p>
            {unknown.map(({ item }) => (
              <Link
                key={item.id}
                className="block underline py-2"
                href={`/admin/box/${item.box_id}`}
              >
                {item.name}
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
