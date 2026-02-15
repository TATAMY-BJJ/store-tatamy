import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { sanitizeCsvCell } from '@/lib/validation';

// GET /api/export - Export CSV celého skladu (admin)
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
  }

  const { data: boxes, error } = await supabase
    .from('boxes')
    .select('*, section:sections(name, responsible_person), items(*, lendings(*))')
    .order('name');

  if (error) {
    console.error('DB error:', error.message);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }

  // Generování CSV
  const BOM = '\uFEFF'; // Pro správné zobrazení češtiny v Excelu
  const header = 'Krabice;Sekce;Zodpovědná osoba;Položka;Počet;Minimální počet;Poznámka;Půjčeno komu;Půjčeno kolik';
  const rows: string[] = [];

  for (const box of boxes || []) {
    const section = box.section as { name: string; responsible_person: string | null } | null;
    const items = (box.items || []) as Array<{
      name: string;
      quantity: string | null;
      min_quantity: string | null;
      note: string | null;
      lendings?: Array<{ lent_to: string; quantity: string }>;
    }>;

    if (items.length === 0) {
      rows.push([
        escapeCsv(sanitizeCsvCell(box.name)),
        escapeCsv(sanitizeCsvCell(section?.name || '')),
        escapeCsv(sanitizeCsvCell(section?.responsible_person || '')),
        '', '', '', '', '', ''
      ].join(';'));
    } else {
      for (const item of items) {
        const lendings = item.lendings || [];
        const lentToStr = lendings.map((l) => l.lent_to).join(', ');
        const lentQtyStr = lendings.map((l) => `${l.lent_to}: ${l.quantity}`).join(', ');
        rows.push([
          escapeCsv(sanitizeCsvCell(box.name)),
          escapeCsv(sanitizeCsvCell(section?.name || '')),
          escapeCsv(sanitizeCsvCell(section?.responsible_person || '')),
          escapeCsv(sanitizeCsvCell(item.name)),
          escapeCsv(sanitizeCsvCell(item.quantity || '')),
          escapeCsv(sanitizeCsvCell(item.min_quantity || '')),
          escapeCsv(sanitizeCsvCell(item.note || '')),
          escapeCsv(sanitizeCsvCell(lentToStr)),
          escapeCsv(sanitizeCsvCell(lentQtyStr)),
        ].join(';'));
      }
    }
  }

  const csv = BOM + header + '\n' + rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sklad-tatamy.csv"',
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
