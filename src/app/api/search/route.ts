import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Remove diacritics from a string for accent-insensitive search.
 * "taška" → "taska", "příliš" → "prilis"
 */
function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// GET /api/search?q=taška - Hledání krabic a položek (accent-insensitive)
export async function GET(request: NextRequest) {
  const rawQ = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
  const q = rawQ?.slice(0, 200);

  if (!q || q.length < 2) {
    return NextResponse.json({ boxes: [], items: [] });
  }

  const qNorm = removeDiacritics(q);

  // Stáhnout data a filtrovat na serveru (accent-insensitive)
  const [boxesResult, itemsResult] = await Promise.all([
    supabase
      .from('boxes')
      .select('id, name, section:sections(name)')
      .order('name'),
    supabase
      .from('items')
      .select('id, name, quantity, min_quantity, box_id, box:boxes(id, name)')
      .order('name'),
  ]);

  const boxes = (boxesResult.data || [])
    .filter((b) => {
      const nameNorm = removeDiacritics(b.name.toLowerCase());
      return nameNorm.includes(qNorm);
    })
    .slice(0, 10)
    .map((b) => {
      const section = b.section as unknown as { name: string } | null;
      return {
        id: b.id,
        name: b.name,
        sectionName: section?.name || null,
      };
    });

  const items = (itemsResult.data || [])
    .filter((i) => {
      const nameNorm = removeDiacritics(i.name.toLowerCase());
      return nameNorm.includes(qNorm);
    })
    .slice(0, 20)
    .map((i) => {
      const box = i.box as unknown as { id: number; name: string } | null;
      return {
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        boxId: box?.id || i.box_id,
        boxName: box?.name || '',
      };
    });

  return NextResponse.json({ boxes, items });
}
