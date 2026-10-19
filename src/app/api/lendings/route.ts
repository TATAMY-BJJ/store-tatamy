import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { requireString, sanitizeString } from '@/lib/validation';

// POST /api/lendings - Vytvořit novou výpůjčku (admin)
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { item_id } = body;

    if (typeof item_id !== 'number' || !Number.isInteger(item_id) || item_id <= 0) {
      return NextResponse.json({ error: 'Neplatné item_id' }, { status: 400 });
    }

    const lent_to = requireString(body.lent_to, 200);
    const quantity = requireString(body.quantity, 100);

    if (!lent_to || !quantity) {
      return NextResponse.json(
        { error: 'Chybí povinné údaje (lent_to, quantity)' },
        { status: 400 }
      );
    }

    const note = sanitizeString(body.note, 500);
    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from('lendings')
      .insert({
        item_id,
        lent_to,
        quantity,
        note,
      })
      .select()
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Interní chyba serveru' }, { status: error.code === 'P0001' ? 409 : 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Chyba při vytváření výpůjčky' }, { status: 500 });
  }
}
