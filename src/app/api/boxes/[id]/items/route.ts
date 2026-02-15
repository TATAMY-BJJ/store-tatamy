import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { isValidId, requireString, sanitizeString } from '@/lib/validation';

// POST /api/boxes/[id]/items - Přidat položeku do krabice (admin)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizávano' }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 });
  }

  try {
    const body = await request.json();

    const name = requireString(body.name, 500);
    if (!name) {
      return NextResponse.json({ error: 'Název je povinný (max 500 znaků)' }, { status: 400 });
    }

    const quantity = sanitizeString(body.quantity, 500);
    const min_quantity = sanitizeString(body.min_quantity, 500);
    const note = sanitizeString(body.note, 500);

    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from('items')
      .insert({
        box_id: Number(id),
        name,
        quantity: quantity || null,
        min_quantity: min_quantity || null,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Chyba při přidávání položky' }, { status: 500 });
  }
}
