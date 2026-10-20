import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { stockStatus } from '@/lib/stock';
import Header from '@/components/Header';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 0; // Vždy čerstvá data

interface BoxPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoxPage({ params }: BoxPageProps) {
  const { id } = await params;

  const { data: box, error } = await supabase
    .from('boxes')
    .select('*, section:sections(name, responsible_person, color), items(*, lendings(*))')
    .eq('id', id)
    .single();

  if (error || !box) {
    notFound();
  }

  const isAdmin = await isAuthenticated();
  const section = box.section as { name: string; responsible_person: string | null; color: string | null } | null;
  const sectionColor = section?.color || null;
  const items = (box.items || []) as Array<{
    id: number;
    name: string;
    quantity: string | null;
    min_quantity: string | null;
    note: string | null;
    last_checked_date?: string | null;
    legacy_quantity?: string | null;
    lendings?: Array<{ id: number; lent_to: string; quantity: string }>;
  }>;

  return (
    <div className="min-h-screen bg-white">
      <Header showBackButton backHref="/" backLabel="Celý sklad" />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Název krabice */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-tatamy-black">{box.name}</h1>
          {section?.responsible_person && (
            <p className="text-sm text-gray-500 mt-1">
              Zodpovědná osoba: <span className="font-medium text-gray-700">{section.responsible_person}</span>
            </p>
          )}
        </div>

        {/* Admin banner — rychlý přístup k editaci */}
        {isAdmin && (
          <Link
            href={`/admin/box/${id}`}
            className="flex items-center justify-between bg-tatamy-red text-white px-4 py-3 rounded-xl mb-6 hover:bg-tatamy-red-dark active:bg-tatamy-red-dark transition-colors shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <span className="font-semibold text-sm">Editovat tuto krabici</span>
            </div>
            <span className="text-white/70 text-xs">Admin →</span>
          </Link>
        )}

        {/* Tabulka položek */}
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">Krabice je prázdná</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={sectionColor ? 'text-white' : 'bg-tatamy-gray border-b-2 border-tatamy-gray-mid'}
                  style={sectionColor ? { backgroundColor: sectionColor } : undefined}
                >
                  <th className={`text-left px-4 py-3 font-semibold ${sectionColor ? 'text-white' : 'text-tatamy-black'}`}>Položka</th>
                  <th className={`text-center px-3 py-3 font-semibold w-20 ${sectionColor ? 'text-white' : 'text-tatamy-black'}`}>Počet</th>
                  <th className={`text-center px-3 py-3 font-semibold w-20 hidden sm:table-cell ${sectionColor ? 'text-white' : 'text-tatamy-black'}`}>Min.</th>
                  <th className={`text-left px-3 py-3 font-semibold hidden md:table-cell ${sectionColor ? 'text-white' : 'text-tatamy-black'}`}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const belowMin = (stockStatus(item).missing ?? 0) > 0;
                  const lendings = item.lendings || [];
                  const hasLendings = lendings.length > 0;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 ${
                        belowMin ? 'bg-red-50' : hasLendings ? 'bg-orange-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={belowMin ? 'text-tatamy-red font-medium' : ''}>
                          {item.name}
                        </span>
                        {item.legacy_quantity && <p className="text-xs text-gray-600">Původní text množství: {item.legacy_quantity}</p>}
                        {item.last_checked_date && <p className="text-xs text-gray-600">Přepočítáno {new Date(item.last_checked_date + 'T12:00:00').toLocaleDateString('cs-CZ')}</p>}
                        {/* Výpůjčky */}
                        {hasLendings && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lendings.map((l) => (
                              <span key={l.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                Půjčeno {l.quantity} ks — {l.lent_to}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Poznámka na mobilu - pod názvem */}
                        {item.note && (
                          <p className="text-xs text-gray-400 mt-0.5 md:hidden">{item.note}</p>
                        )}
                        {/* Min. počet na mobilu */}
                        {item.min_quantity && (
                          <p className="text-xs text-gray-400 mt-0.5 sm:hidden">
                            Min: {item.min_quantity}
                          </p>
                        )}
                      </td>
                      <td className={`text-center px-3 py-3 font-medium ${
                        belowMin ? 'text-tatamy-red font-bold' : ''
                      }`}>
                        {item.quantity || '—'}
                      </td>
                      <td className="text-center px-3 py-3 text-gray-400 hidden sm:table-cell">
                        {item.min_quantity || '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell">
                        {item.note || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tlačítko - celý sklad */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block bg-tatamy-black text-white px-6 py-3 rounded-lg font-medium hover:bg-tatamy-dark transition-colors"
          >
            Zobrazit celý sklad
          </Link>
        </div>
      </main>
    </div>
  );
}
