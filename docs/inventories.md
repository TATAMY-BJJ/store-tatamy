# Inventury podle data

## Význam údajů

- `items.quantity` znamená fyzický počet ve skladu, bez aktivních výpůjček.
- Celkový dohledaný stav = sklad + aktivní výpůjčky. Minimum se porovnává s celkem.
- 97 ve skladu + 3 půjčené při minimu 100: žádný nákup ani ztráta, pouze vyžádat 3 zpět.
- Inventura má datum zahájení; každá položka vlastní datum skutečného přepočítání a oddělený čas zápisu.
- První přepočítání porovná skutečnost s tehdy evidovaným celkem. Oprava zachová původní očekávaný počet. Nečíselný původní počet vytvoří výchozí stav bez vymyšleného rozdílu.
- `legacy_quantity` uchovává původní textový rozpis (například velikosti oblečení). Je vidět v detailu i historii, ale není to aktuální počet ani automaticky aktualizovaný seznam variant. `original_quantity` a `original_note` uchovávají vstupní údaje při prvním přepočítání. Číselný počet vždy zadává člověk.
- Jedna rozpracovaná inventura. Nové položky do ní přibývají automaticky; položky lze mazat až po uzavření a vrácení výpůjček.
- Uzavření vyžaduje kontrolu všech položek. Historie uchovává kopie názvů, minima, typu, počtů i výpůjček a není závislá na existenci živé položky.
- Výpůjčka automaticky odečte počet ze skladu. Vrácení jej přičte a výpůjčku přesune do `lending_history`. Staré již smazané výpůjčky nelze zpětně obnovit.

## Před nasazením

1. Ověřit správný Supabase projekt skladu (nesplést s databází sportovců). Kód neobsahuje produkční klíče.
2. Udělat zálohu a ověřit skutečné schéma. `supabase-schema.sql` je pouze původní výchozí schéma; znovu jej nespouštět na produkci.
3. Provést read-only kontrolu položek s aktivními výpůjčkami: znamená současné `quantity` fyzický sklad? Pokud zahrnuje půjčené kusy, před aktivací pohybů je nutné odsouhlasit a opravit konkrétní počty. Migrace sama existující množství nepřepočítává.
4. Vypsat nečíselné a prázdné hodnoty `items.quantity`, `items.min_quantity`, `lendings.quantity`. Zachovat původní texty; žádné automatické převody „2 balení“ na dva kusy. Číselná inventura může založit nový výchozí stav.
5. Na kopii databáze aplikovat `supabase/migrations/202610180001_inventories.sql`, vyzkoušet inventuru a výpůjčky. Lokální integrační test používá PostgreSQL přes PGlite a skutečnou migraci.
6. V koordinovaném nasazení krátce zastavit zápisy, aplikovat migraci a nasadit aplikaci. Staré UI nepočítá s automatickými skladovými pohyby, proto po migraci neponechávat starou aplikaci aktivní.
7. Nastavit serverový `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` a stávající přihlašovací proměnné. Nové tabulky ani RPC nejsou dostupné veřejným rolím.
8. Existující položky ručně rozdělit na majetek a spotřební materiál. Výchozí typ `unclassified` brání chybnému automatickému zařazení.

## Ověření

`npm test` — výpočty, skutečná SQL migrace, výpůjčky, uzavření, historie a přístupová práva.

`npm run lint`, `npx tsc --noEmit`, `npm run build`.

`npm run test:http` po buildu prověří skutečné Next.js API a serverový výstup stránek proti místní databázi: odmítnutí nepřihlášeného zápisu, neplatného data, předčasného uzavření a změny historie; přepočítání, zachování textu a vyžádání výpůjčky zpět.

`npm run preview:local` spustí stejný oddělený náhled na `http://127.0.0.1:3131/admin` (heslo `preview-local`). Dvě smyšlené položky; žádná produkční data. Podporuje průchod inventurou, nikoliv běžné editace skladu. Po zastavení se testovací data zahodí. Porty 3131/3132 musí být volné.

### Výsledek kontroly produkčních dat

Read-only kontrola 19. 10. 2026: 10 sekcí, 59 krabic, 428 položek, 0 aktivních výpůjček; 94 chybějících počtů, 7 textových počtů, 158 nastavených minim. Jde o stav při kontrole, před nasazením kontrolu zopakovat.

`npm run db:preflight` uloží export aplikačních tabulek do `.local/preflight-<timestamp>.json`. Export neobsahuje klíče, není verzovaný a není náhradou úplné Supabase zálohy (nezahrnuje funkce, oprávnění, jiné tabulky ani konzistentní transakční snapshot).

`npm run test:snapshot -- .local/preflight-<timestamp>.json` aplikuje migraci na export v místním PostgreSQL, ověří zachování původních počtů/poznámek a simuluje dokončení inventury. Simulace nastavuje testovací typy a počty jen v paměti a nikdy je neodesílá zpět.

### Nasazení a návrat

- Nejdřív databázová záloha a zastavení skladových zápisů, potom migrace a nová verze aplikace. Samotná migrace běží v jedné transakci; při chybě se nepotvrdí žádná její část.
- Po nasazení ověřit přihlášení, seznam položek, zachování textových rozpisů a shodu počtů. Produkční inventuru založit až při skutečné kontrole; pro zkoušení používat místní demo.
- Při problému ponechat zápisy zastavené. Návrat starého UI při aktivních nových triggerech není bezpečný. Po prvních nových skladových pohybech neprovádět automatický down-migration ani obnovu staré zálohy, která by tyto pohyby ztratila; připravit dopřednou opravu a porovnat historii.
- API export neověřuje skutečné RLS politiky ani všechny produkční triggery. Před aplikací migrace zkontrolovat schéma a oprávnění v SQL Editoru a potvrdit úplnou zálohu. Přístupový service-role klíč sám neumožňuje spouštět libovolné DDL přes REST API.

Bez konfigurace Supabase lze ověřit kód a lokální databázové testy; nelze tvrdit, že byla ověřena nebo změněna živá databáze.


### Předání a vizuální kontrola

`npm run test:browser` prověří přihlášení, mobilní i desktopové rozložení, validní zobrazení dat, přepočítání, uzavření a dohledání výpůjček v Chromu. Kontrolní snímky jsou v ignorované `.local/qa/`. Test lze spustit proti již běžícímu místnímu demu nebo nechá demo spustit automaticky; vyžaduje předchozí build a nainstalovaný Chrome. Pro Edge nastavte `PLAYWRIGHT_CHANNEL=msedge`.

Ověřeno 19. 10. 2026: unit/SQL testy, migrace na exportu 428 položek, HTTP workflow, lint, TypeScript, produkční build a prohlížeč na šířkách 375 a 1440 px. Sedm původních textových množství zachováno. Vizuální kontrola odhalila a opravila rozdílné formátování SQL DATE v místním adaptéru; test výslovně odmítá `Invalid Date`.

Před produkčním nasazením stále zbývá: spustit read-only `supabase/preflight.sql` v SQL Editoru správného projektu, porovnat skutečné triggery/RLS/oprávnění s migrací, ověřit úplnou zálohu a koordinovat přepnutí aplikace. Produkční data ani schéma zatím změněny nebyly.
