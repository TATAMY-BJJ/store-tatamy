import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import AdminSectionsClient from '@/components/AdminSectionsClient';

export const revalidate = 0;

export default async function AdminSectionsPage() {
  if (!(await isAuthenticated())) {
    redirect('/admin');
  }

  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .order('name');

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin showBackButton backHref="/admin/dashboard" backLabel="Dashboard" />
      <AdminSectionsClient initialSections={sections || []} />
    </div>
  );
}
