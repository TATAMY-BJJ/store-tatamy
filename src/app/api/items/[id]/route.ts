import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { isValidId, sanitizeString } from '@/lib/validation';

// PUT /api/items/[id] - Aktualizovat položku (admin)
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
    const sb = getServiceSupabase();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = sanitizeString(body.name, 500);
      if (!name) return NextResponse.json({ error: 'Neplatný název' }, { status: 400 });
      updateData.name = name;
    }
    if (body.item_type !== undefined) {
      if (!['asset', 'consumable', 'unclassified'].includes(body.item_type)) return NextResponse.json({ error: 'Neplatný typ položky' }, { status: 400 });
      updateData.item_type = body.item_type;
    }
    if (body.quantity !== undefined) updateData.quantity = sanitizeString(body.quantity, 500);
    if (body.min_quantity !== undefined) updateData.min_quantity = sanitizeString(body.min_quantity, 500);
    if (body.note !== undefined) updateData.note = sanitizeString(body.note, 500);
    if (body.box_id !== undefined) {
      if (typeof body.box_id !== 'number' || !Number.isInteger(body.box_id) || body.box_id <= 0) {
        return NextResponse.json({ error: 'Neplatné box_id' }, { status: 400 });
      }
      updateData.box_id = body.box_id;
    }

    const { data, error } = await sb
      .from('items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB error:', error.message);
      return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Interní chyba serveru' }, { status: error.code === 'P0001' ? 409 : 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Chyba při aktualizaci položky' }, { status: 500 });
  }
}

// DELETE /api/items/[id] - Smazat položku (admin)
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
    .from('items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Interní chyba serveru' }, { status: error.code === 'P0001' ? 409 : 500 });
  }

  return NextResponse.json({ success: true });
}
