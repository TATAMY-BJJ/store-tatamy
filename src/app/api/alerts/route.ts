import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { stockStatus } from '@/lib/stock';

// GET /api/alerts - Položky pod minimálním stavem (admin)
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  const { data: items, error } = await supabase
    .from('items')
    .select('*, box:boxes(name, section:sections(name)), lendings(*)')
    .not('min_quantity', 'is', null);

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  // Filtrovat položky pod minimem
  const alerts = (items || []).filter((item) => {
    return (stockStatus(item).missing ?? 0) > 0;
  }).map((item) => ({
    ...stockStatus(item),
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    min_quantity: item.min_quantity,
    box_id: item.box_id,
    box_name: (item.box as { name: string })?.name || '',
    section_name: (item.box as { section: { name: string } | null })?.section?.name || null,
  }));

  return NextResponse.json(alerts);
}
