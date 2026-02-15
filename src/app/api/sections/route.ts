import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { requireString, sanitizeString } from '@/lib/validation';

// GET /api/sections - Seznam sekcí
export async function GET() {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .order('name');

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/sections - Vytvořit sekci (admin)
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

    const responsiblePerson = sanitizeString(body.responsible_person, 200);
    const color = sanitizeString(body.color, 20);
    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from('sections')
      .insert({
        name,
        responsible_person: responsiblePerson,
        color,
      })
      .select()
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Chyba při vytváření sekce' }, { status: 500 });
  }
}
