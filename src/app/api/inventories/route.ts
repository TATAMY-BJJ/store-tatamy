import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { quantityNumber } from '@/lib/stock';

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  const validId = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  const validDate =
    typeof body.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.date) &&
    !isNaN(Date.parse(body.date)) &&
    new Date(body.date).toISOString().slice(0, 10) === body.date;
  const sb = getServiceSupabase();
  let result;
  if (body.action === 'start' && validDate) {
    result = await sb.rpc('start_inventory', { p_date: body.date });
  } else if (
    body.action === 'check' &&
    validId(body.inventoryId) &&
    validId(body.itemId) &&
    validDate &&
    typeof body.count === 'string' &&
    quantityNumber(body.count) !== null
  ) {
    result = await sb.rpc('check_inventory_item', {
      p_inventory: body.inventoryId,
      p_item: body.itemId,
      p_count: quantityNumber(body.count),
      p_date: body.date,
    });
  } else if (body.action === 'close' && validId(body.inventoryId)) {
    result = await sb.rpc('close_inventory', { p_inventory: body.inventoryId });
  } else
    return NextResponse.json(
      { error: 'Zkontrolujte datum a nezáporný číselný počet.' },
      { status: 400 },
    );
  if (result.error) {
    const error = result.error;
    const message =
      error.code === 'P0001'
        ? error.message
        : error.code === '23505'
          ? 'Nejdřív dokončete rozpracovanou inventuru.'
          : 'Inventuru se nepodařilo uložit. Obnovte stránku a zkuste to znovu.';
    console.error('Inventory operation failed:', error.code);
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ id: result.data, success: true });
}
