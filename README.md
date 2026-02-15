# TATAMY Sklad

Jednoduchý online skladový systém pro správu krabic s vybavením na turnaje TATAMY.

## Funkce

- **QR kódy** na krabicích → naskenuj a uvidíš obsah
- **Admin rozhraní** pro správu krabic, položek a sekcí
- **Upozornění** na položky pod minimálním stavem
- **CSV export** celého skladu
- **Hromadné stažení** QR kódů jako ZIP

## Tech stack

- Next.js 14 (App Router)
- Supabase (PostgreSQL)
- Tailwind CSS
- Vercel (hosting)

## Nastavení

### 1. Supabase

1. Vytvořte účet na [supabase.com](https://supabase.com)
2. Vytvořte nový projekt
3. V SQL editoru spusťte obsah souboru `supabase-schema.sql`
4. Poznamenejte si:
   - Project URL (`https://xxxxx.supabase.co`)
   - Anon Key (z Settings → API)
   - Service Role Key (z Settings → API)

### 2. Konfigurace

Zkopírujte `.env.local.example` na `.env.local` a vyplňte:

```bash
cp .env.local.example .env.local
```

Nastavte:
- `NEXT_PUBLIC_SUPABASE_URL` - URL vašeho Supabase projektu
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon Key
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key
- `ADMIN_PASSWORD` - heslo pro admin přihlášení
- `NEXT_PUBLIC_APP_URL` - URL aplikace (pro QR kódy)

### 3. Import dat

Umístěte CSV soubory do složky `data/` a spusťte:

```bash
npx tsx scripts/import-data.ts
```

### 4. Lokální vývoj

```bash
npm install
npm run dev
```

Aplikace poběží na `http://localhost:3000`.

### 5. Deploy na Vercel

1. Pushněte kód na GitHub
2. Importujte projekt na [vercel.com](https://vercel.com)
3. Nastavte Environment Variables (stejné jako `.env.local`)
4. V DNS nastavte CNAME záznam: `store.tatamy.cz` → `cname.vercel-dns.com`

## Stránky

| URL | Popis |
|-----|-------|
| `/` | Přehled skladu (veřejný) |
| `/box/{id}` | Detail krabice (cíl QR kódu) |
| `/admin` | Admin přihlášení |
| `/admin/dashboard` | Admin dashboard |
| `/admin/box/{id}` | Editace krabice |
| `/admin/sections` | Správa sekcí |
| `/admin/alerts` | Položky pod minimem |
