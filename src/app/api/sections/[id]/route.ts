import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { isValidId, sanitizeString } from '@/lib/validation';

// PUT /api/sections/[id] - Aktualizovat sekci (admin)
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

    const responsiblePerson = sanitizeString(body.responsible_person, 200);
    const color = body.color !== undefined ? sanitizeString(body.color, 20) : undefined;
    const sb = getServiceSupabase();

    const updateData: Record<string, unknown> = {
      name: body.name,
      responsible_person: responsiblePerson,
    };
    if (color !== undefined) {
      updateData.color = color;
    }

    const { data, error } = await sb
      .from('sections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Chyba při aktualizaci sekce' }, { status: 500 });
  }
}

// DELETE /api/sections/[id] - Smazat sekci (admin)
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
    .from('sections')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
