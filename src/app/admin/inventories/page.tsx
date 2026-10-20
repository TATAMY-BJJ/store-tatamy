import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import Header from '@/components/Header';
import InventoriesClient from '@/components/InventoriesClient';

export const dynamic = 'force-dynamic';

export default async function InventoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; box?: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin');
  const params = await searchParams;
  const sb = getServiceSupabase();
  const { data: inventories, error } = await sb
    .from('inventories')
    .select('*')
    .order('created_at', { ascending: false });
  if (error)
    return (
      <>
        <Header admin />
        <main className="max-w-5xl mx-auto p-6">
          <h1 className="text-2xl font-bold">Inventury</h1>
          <p role="alert" className="mt-4">
            Inventury se nepodařilo načíst. Zkuste stránku obnovit; při prvním spuštění je potřeba
            dokončit nastavení databáze.
          </p>
        </main>
      </>
    );
  const selected = params.id
    ? inventories?.find((i) => String(i.id) === params.id)
    : inventories?.find((i) => i.status === 'open') || inventories?.[0];
  const { data: entries, error: entriesError } = selected
    ? await sb
        .from('inventory_entries')
        .select('*')
        .eq('inventory_id', selected.id)
        .order('box_name')
        .order('item_name')
    : { data: [], error: null };
  const { data: items, error: itemsError } =
    selected?.status === 'open'
      ? await sb.from('items').select('*, lendings(*)')
      : { data: [], error: null };
  if (entriesError || itemsError) throw new Error('Nepodařilo se načíst položky inventury.');
  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header admin showBackButton backHref="/admin/dashboard" backLabel="Sklad" />
      <InventoriesClient
        key={selected?.id || 'new'}
        inventories={inventories || []}
        selected={selected || null}
        entries={entries || []}
        items={items || []}
        initialBox={params.box || ''}
      />
    </div>
  );
}
