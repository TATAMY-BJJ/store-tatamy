import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { requireString } from '@/lib/validation';

// GET /api/boxes - Seznam všech krabic s sekcemi
export async function GET() {
  const { data, error } = await supabase
    .from('boxes')
    .select('*, section:sections(*), items(*)')
    .order('name');

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/boxes - Vytvořit novou krabici (admin)
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const name = requireString(body.name, 200);
    if (!name) {
      return NextResponse.json({ error: 'Název je povinný (max 200 znaků)' }, { status: 400 });
    }

    const sectionId = body.section_id;
    if (sectionId !== null && sectionId !== undefined && (typeof sectionId !== 'number' || !Number.isInteger(sectionId))) {
      return NextResponse.json({ error: 'Neplatné section_id' }, { status: 400 });
    }

    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from('boxes')
      .insert({
        name,
        section_id: sectionId || null,
        has_qr: body.has_qr !== false,
      })
      .select('*, section:sections(*)')
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Chyba při vytváření krabice' }, { status: 500 });
  }
}
