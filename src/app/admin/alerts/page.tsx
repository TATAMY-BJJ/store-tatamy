import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { parseNumericValue } from '@/lib/types';
import type { Lending } from '@/lib/types';
import Header from '@/components/Header';
import Link from 'next/link';

export const revalidate = 0;

export default async function AdminAlertsPage() {
  if (!(await isAuthenticated())) {
    redirect('/admin');
  }

  const { data: items } = await supabase
    .from('items')
    .select('*, box:boxes(id, name, section:sections(name)), lendings(*)')
    .not('min_quantity', 'is', null);

  const alerts = (items || [])
    .filter((item) => {
      const qty = parseNumericValue(item.quantity);
      const minQty = parseNumericValue(item.min_quantity);
      if (qty === null || minQty === null) return false;
      return qty < minQty;
    })
    .sort((a, b) => {
      const boxA = (a.box as { name: string })?.name || '';
      const boxB = (b.box as { name: string })?.name || '';
      return boxA.localeCompare(boxB, 'cs');
    });

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin showBackButton backHref="/admin/dashboard" backLabel="Dashboard" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-tatamy-black mb-2">
          Položky pod minimálním stavem
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {alerts.length === 0 ? 'Všechno v pořádku!' : `${alerts.length} položek potřebuje doplnit`}
        </p>

        {alerts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 border-b border-red-200">
                  <th className="text-left px-4 py-3 font-medium text-tatamy-red">Krabice</th>
                  <th className="text-left px-3 py-3 font-medium text-tatamy-red">Položka</th>
                  <th className="text-center px-3 py-3 font-medium text-tatamy-red w-16">Počet</th>
                  <th className="text-center px-3 py-3 font-medium text-tatamy-red w-16">Min.</th>
                  <th className="text-center px-3 py-3 font-medium text-tatamy-red w-16 hidden sm:table-cell">Chybí</th>
                  <th className="text-left px-3 py-3 font-medium text-tatamy-red hidden md:table-cell">Stav</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((item) => {
                  const box = item.box as { id: number; name: string; section: { name: string } | null } | null;
                  const lendings = (item.lendings || []) as Lending[];
                  const qty = parseNumericValue(item.quantity) || 0;
                  const minQty = parseNumericValue(item.min_quantity) || 0;
                  const missing = minQty - qty;
                  const totalLent = lendings.reduce((sum, l) => {
                    const n = parseNumericValue(l.quantity);
                    return sum + (n || 0);
                  }, 0);
                  const hasLendings = lendings.length > 0;
                  // Pokud je celkem půjčeno >= chybějící → stačí vyžádat vrácení
                  const canRecover = hasLendings && totalLent >= missing;

                  return (
                    <tr key={item.id} className={`border-b border-gray-50 ${canRecover ? 'bg-orange-50/50 hover:bg-orange-50' : 'bg-red-50/30 hover:bg-red-50'}`}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/box/${box?.id}`}
                          className="font-medium text-tatamy-black hover:text-tatamy-red transition-colors"
                        >
                          {box?.name}
                        </Link>
                        {box?.section && (
                          <p className="text-xs text-gray-400">{(box.section as { name: string }).name}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{item.name}</span>
                        {/* Mobilní stav */}
                        {hasLendings && (
                          <div className="md:hidden mt-1 flex flex-wrap gap-1">
                            {lendings.map((l) => (
                              <span key={l.id} className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                                {l.lent_to}: {l.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-center px-3 py-3 text-tatamy-red font-bold">{item.quantity}</td>
                      <td className="text-center px-3 py-3 text-gray-500">{item.min_quantity}</td>
                      <td className="text-center px-3 py-3 text-tatamy-red font-bold hidden sm:table-cell">
                        -{missing}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {hasLendings ? (
                          <div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              canRecover
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {canRecover ? 'Vyžádat vrácení' : 'Dokoupit'}
                            </span>
                            <div className="mt-1 space-y-0.5">
                              {lendings.map((l) => (
                                <p key={l.id} className="text-xs text-orange-600">
                                  → {l.lent_to}: {l.quantity} ks
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            Dokoupit
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
