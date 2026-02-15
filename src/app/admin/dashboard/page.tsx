import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { parseNumericValue } from '@/lib/types';
import Header from '@/components/Header';
import AdminDashboardClient from '@/components/AdminDashboardClient';

export const revalidate = 0;

export default async function AdminDashboard() {
  if (!(await isAuthenticated())) {
    redirect('/admin');
  }

  // Načíst krabice
  const { data: boxes } = await supabase
    .from('boxes')
    .select('*, section:sections(id, name, responsible_person, color), items(*)')
    .order('name');

  // Načíst sekce
  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .order('name');

  // Spočítat alerty
  let alertCount = 0;
  for (const box of boxes || []) {
    const items = (box.items || []) as Array<{ quantity: string | null; min_quantity: string | null }>;
    for (const item of items) {
      const qty = parseNumericValue(item.quantity);
      const minQty = parseNumericValue(item.min_quantity);
      if (qty !== null && minQty !== null && qty < minQty) {
        alertCount++;
      }
    }
  }

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin />
      <AdminDashboardClient
        initialBoxes={boxes || []}
        initialSections={sections || []}
        alertCount={alertCount}
      />
    </div>
  );
}
