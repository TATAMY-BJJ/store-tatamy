import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Všechny dotazy jdou přes server (Server Components + API routes),
// takže bezpečně použijeme service_role klíč pro vše.
// RLS se tím obchází, ale to je OK - auth řešíme v aplikaci.

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !key) {
      throw new Error('Chybí Supabase konfigurace v .env.local');
    }
    _client = createClient(supabaseUrl, key);
  }
  return _client;
}

// Proxy pro čtení (server-side)
export const supabase = {
  from: (...args: Parameters<SupabaseClient['from']>) => getClient().from(...args),
};

// Pro zápis (admin operace) - stejný klient
export function getServiceSupabase(): SupabaseClient {
  return getClient();
}
