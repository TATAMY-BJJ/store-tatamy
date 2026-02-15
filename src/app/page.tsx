import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Link from 'next/link';

export const revalidate = 0;

export default async function HomePage() {
  const { data: boxes } = await supabase
    .from('boxes')
    .select('*, section:sections(id, name, responsible_person, color), items(id)')
    .order('name');

  // Seskupit krabice podle sekcí
  const sectionMap = new Map<string, {
    sectionName: string;
    responsiblePerson: string | null;
    color: string | null;
    boxes: Array<{
      id: number;
      name: string;
      itemCount: number;
    }>;
  }>();

  // Sekce "Bez sekce" pro krabice bez přiřazení
  const NO_SECTION = '__none__';

  for (const box of boxes || []) {
    const section = box.section as { id: number; name: string; responsible_person: string | null; color: string | null } | null;
    const key = section?.name || NO_SECTION;
    const items = (box.items || []) as Array<{ id: number }>;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        sectionName: section?.name || 'Bez sekce',
        responsiblePerson: section?.responsible_person || null,
        color: section?.color || null,
        boxes: [],
      });
    }
    sectionMap.get(key)!.boxes.push({
      id: box.id,
      name: box.name,
      itemCount: items.length,
    });
  }

  // Seřadit: sekce abecedně, "Bez sekce" na konec
  const sections = Array.from(sectionMap.entries()).sort((a, b) => {
    if (a[0] === NO_SECTION) return 1;
    if (b[0] === NO_SECTION) return -1;
    return a[1].sectionName.localeCompare(b[1].sectionName, 'cs');
  });

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-tatamy-black mb-2">Přehled skladu</h1>
        <p className="text-sm text-gray-500 mb-6">
          Klikněte na krabici pro zobrazení obsahu, nebo použijte vyhledávání nahoře
        </p>

        {/* Seznam podle sekcí */}
        <div className="space-y-6">
          {sections.map(([key, data]) => (
            <div key={key} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div
                className="text-white px-4 py-3"
                style={{ backgroundColor: data.color || '#1e1e1e' }}
              >
                <h2 className="font-semibold">{data.sectionName}</h2>
                {data.responsiblePerson && (
                  <p className="text-xs text-white/70 mt-0.5">{data.responsiblePerson}</p>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {data.boxes.map((box) => (
                  <Link
                    key={box.id}
                    href={`/box/${box.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-tatamy-gray transition-colors"
                  >
                    <span className="font-medium text-tatamy-black">{box.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                      {box.itemCount} {box.itemCount === 1 ? 'položka' : box.itemCount < 5 ? 'položky' : 'položek'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
