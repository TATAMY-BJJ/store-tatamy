import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { isValidId } from '@/lib/validation';

// DELETE /api/lendings/[id] - Vrátit (smazat výpůjčku) (admin)
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
    .from('lendings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Interní chyba serveru' }, { status: error.code === 'P0001' ? 409 : 500 });
  }

  return NextResponse.json({ success: true });
}
