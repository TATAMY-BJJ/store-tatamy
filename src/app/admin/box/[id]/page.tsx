import { redirect, notFound } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import AdminBoxEditor from '@/components/AdminBoxEditor';

export const revalidate = 0;

interface AdminBoxPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBoxPage({ params }: AdminBoxPageProps) {
  if (!(await isAuthenticated())) {
    redirect('/admin');
  }

  const { id } = await params;

  const { data: box, error } = await supabase
    .from('boxes')
    .select('*, section:sections(*), items(*, lendings(*))')
    .eq('id', id)
    .single();

  if (error || !box) {
    notFound();
  }

  const [{ data: sections }, { data: allBoxes }] = await Promise.all([
    supabase.from('sections').select('*').order('name'),
    supabase.from('boxes').select('id, name').order('name'),
  ]);

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin showBackButton backHref="/admin/dashboard" backLabel="Dashboard" />
      <AdminBoxEditor box={box} sections={sections || []} allBoxes={allBoxes || []} />
    </div>
  );
}
