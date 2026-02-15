import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { isValidId, sanitizeString } from '@/lib/validation';

// GET /api/boxes/[id] - Detail krabice
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('boxes')
    .select('*, section:sections(*), items(*)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Krabice nenalezena' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT /api/boxes/[id] - Aktualizovat krabici (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 });
  }

  try {
    const body = await request.json();

    const name = sanitizeString(body.name, 200);
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: 'Neplatný název (max 200 znaků)' }, { status: 400 });
    }

    const sb = getServiceSupabase();

    const { data, error } = await sb
      .from('boxes')
      .update({
        name: body.name,
        section_id: body.section_id,
        has_qr: body.has_qr,
      })
      .eq('id', id)
      .select('*, section:sections(*)')
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Chyba při aktualizaci' }, { status: 500 });
  }
}

// DELETE /api/boxes/[id] - Smazat krabici (admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Neplatné ID' }, { status: 400 });
  }

  const sb = getServiceSupabase();

  const { error } = await sb
    .from('boxes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
