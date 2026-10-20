import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only override allows offline tests without touching the production project.
const supabaseUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Chybí serverový Supabase klíč. Zápis s veřejným klíčem není povolen.');
  }
  return getClient();
}
