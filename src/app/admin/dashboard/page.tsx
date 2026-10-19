import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { stockStatus } from '@/lib/stock';
import type { Item } from '@/lib/types';
import Header from '@/components/Header';
import AdminDashboardClient from '@/components/AdminDashboardClient';

export const revalidate = 0;

export default async function AdminDashboard() {
  if (!(await isAuthenticated())) {
    redirect('/admin');
  }

  // Načíst krabice
  const { data: boxes, error: boxesError } = await supabase
    .from('boxes')
    .select('*, section:sections(id, name, responsible_person, color), items(*, lendings(*))')
    .order('name');

  // Načíst sekce
  const { data: sections, error: sectionsError } = await supabase
    .from('sections')
    .select('*')
    .order('name');

  if (boxesError || sectionsError) throw new Error('Nepodařilo se načíst sklad. Obnovte stránku.');

  // Spočítat alerty
  let alertCount = 0;
  for (const box of boxes || []) {
    const items = (box.items || []) as Item[];
    for (const item of items) {
      if ((stockStatus(item).missing ?? 0) > 0) {
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
