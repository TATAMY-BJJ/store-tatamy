# Merch ze Sortly

Export k 28. 10. 2026 obsahuje 178 variant a 667 kusů. Uživatel odsouhlasil výchozí počty a nahrazení starých souhrnných záznamů prodejního zboží. Vybavení stánku se zachovává.

## Rozsah importu

- Existující sekce `merch`, 12 nových skupin podle kategorií Sortly.
- Zachovat všechny velikosti včetně 48 variant s nulovým stavem. Opakovaná Sortly ID označují různé velikosti; klíč importu zahrnuje cestu a název varianty.
- Převzít ceny v Kč. U 26 variant cena chybí; nevyplňovat nulu ani odhad.
- Nahradit pouze staré souhrnné položky ID 222, 223, 349, 361 (dětský merch a ponožky bez počtů). Původní krabice a jejich QR identifikátory zachovat.
- Zachovat všech 12 položek krabice 42 `Merch příslušenství`, zejména zrcadlo, ramínka, nářadí, ubrusy a terminály SumUp. Zachovat všechny ostatní položky včetně oblečení ne na prodej.

## Podklady a ověření

Soukromé podklady jsou v ignorované složce `.local/sortly-merch-2026-10-28/`: originály CSV/PDF, normalizované položky s původními údaji, všech 199 fotografií, jejich hashový manifest, importní SQL a záloha nahrazovaných řádků. ID a množství všech variant souhlasí mezi PDF a CSV.

`build-import.mjs` generuje importní SQL a payload. `rehearse.mjs` zkouší import na místním PostgreSQL nad exportem skladu. Ověřeno: 178 importovaných variant, 667 kusů, zachování 432 původních položek a opakování importu bez přepsání následných změn počtů. Fotografie chybějící u variant se přebírají z nejbližší nadřazené složky; fotografii má výsledně 175 variant.

## Nasazení a import

Push aplikace sám o sobě neprovádí databázovou migraci ani import. Tyto kroky jsou zatím neprovedené:

1. Ověřit platný přístup k Supabase projektu `ozmzjgsxnofxcelrbmpe` a vytvořit aktuální zálohu tabulek i historie. Serverový service-role klíč nenahrazuje přístup pro DDL.
2. Ověřit skutečné schéma a obnovu zálohy na izolované kopii. Před importem zkontrolovat aktivní inventury; neuzavírat je automaticky.
3. Aplikovat pouze novou aditivní migraci `202611130001_merch.sql`. Starší migrace inventur už je v produkci a nesmí se opakovat. Nové sloupce nemění existující data ani oprávnění; původní aplikace s nimi může fungovat.
4. Uložit fotografie do vlastního Supabase Storage bucketu `merch-sortly` pod hashovými názvy podle manifestu a ověřit všechny URL použité v payloadu.
5. Spustit místní `import.sql` jako jednu transakci. Skript odmítne změněné staré záznamy, aktivní výpůjčky, otevřenou inventuru a částečný import. Kompletně provedený import podruhé nic nepřepíše.
6. Ověřit nasazení aplikace na Vercel projektu `store-tatamy`, doméně `sklad.tatamy.cz`, počty importovaných variant a zachování všech ostatních položek. Neprovádět zkušební prodeje v produkci.

Po zahájení prodeje neobnovovat výchozí export přes živá data. Původní údaje v `source_data` slouží k dohledání původu, nikoliv jako aktuální počet.

## Ovládání

Prodavačky použijí stejné přihlášení a editaci položek jako dosud. Pole se ukládá po opuštění; stav uložení je viditelný. Pokud mezitím jiná prodavačka upravila počet, server změnu odmítne a požádá o obnovení stránky. Ceny lze upravit nebo vymazat, fotografie zvětšit. CSV export zahrnuje ceny i odkazy na fotografie.
