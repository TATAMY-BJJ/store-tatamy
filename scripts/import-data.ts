/**
 * Import dat z CSV souborů do Supabase
 * 
 * Spuštění:
 *   npx tsx scripts/import-data.ts
 * 
 * Předpoklady:
 *   - .env.local musí obsahovat SUPABASE_SERVICE_ROLE_KEY a NEXT_PUBLIC_SUPABASE_URL
 *   - CSV soubory musí být v kořeni projektu (nebo upravte cesty níže)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Načíst env z .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx);
        const value = trimmed.substring(eqIdx + 1);
        process.env[key] = value;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ====== CESTY K CSV SOUBORŮM ======
// Upravte podle potřeby
const SKLAD_CSV = path.join(__dirname, '..', 'data', 'sklad před T19.csv');
const KATEGORIE_CSV = path.join(__dirname, '..', 'data', 'kategorie_sklad před T19.csv');

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function readCsv(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) {
    console.error(`Soubor nenalezen: ${filePath}`);
    process.exit(1);
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  // Odstranit BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  return lines.map(parseCsvLine);
}

async function main() {
  console.log('=== TATAMY Sklad - Import dat ===\n');

  // 1. Načíst kategorie CSV
  console.log('Načítám kategorie...');
  const kategorieRows = readCsv(KATEGORIE_CSV);
  // Header: Název krabice;sekce;patří
  const kategorieHeader = kategorieRows[0];
  console.log(`  Hlavička: ${kategorieHeader.join(' | ')}`);

  // Vytvořit sekce (unikátní kombinace sekce + zodpovědná osoba)
  const sectionMap = new Map<string, string | null>(); // name -> responsible_person
  for (let i = 1; i < kategorieRows.length; i++) {
    const row = kategorieRows[i];
    const sectionName = row[1]?.trim();
    const person = row[2]?.trim() || null;
    if (sectionName) {
      // Pokud sekce ještě nemá osobu, nebo tato osoba je delší (více lidí), aktualizovat
      if (!sectionMap.has(sectionName) || (person && (!sectionMap.get(sectionName) || person.length > sectionMap.get(sectionName)!.length))) {
        sectionMap.set(sectionName, person);
      }
    }
  }

  console.log(`  Nalezeno ${sectionMap.size} sekcí`);

  // Vložit sekce do DB
  const sectionDbMap = new Map<string, number>(); // name -> id
  for (const [name, person] of sectionMap.entries()) {
    const { data, error } = await supabase
      .from('sections')
      .insert({ name, responsible_person: person })
      .select()
      .single();

    if (error) {
      console.error(`  Chyba při vkládání sekce "${name}":`, error.message);
    } else {
      sectionDbMap.set(name.toLowerCase(), data.id);
      console.log(`  ✓ Sekce "${name}" (${person || 'bez osoby'}) → ID ${data.id}`);
    }
  }

  // Mapování: název krabice → sekce (z kategorie CSV)
  const boxSectionMap = new Map<string, string>(); // box name lower → section name
  for (let i = 1; i < kategorieRows.length; i++) {
    const row = kategorieRows[i];
    const boxName = row[0]?.trim();
    const sectionName = row[1]?.trim();
    if (boxName && sectionName) {
      boxSectionMap.set(boxName.toLowerCase(), sectionName.toLowerCase());
    }
  }

  // 2. Načíst sklad CSV
  console.log('\nNačítám sklad...');
  const skladRows = readCsv(SKLAD_CSV);
  // Header: ID krabice;Název krabice;obsah krabice;minimální počet;před T17;před T18;před T19
  const skladHeader = skladRows[0];
  console.log(`  Hlavička: ${skladHeader.join(' | ')}`);

  // Parsovat krabice a položky
  let currentBoxName = '';
  const boxesData: Array<{
    name: string;
    items: Array<{
      name: string;
      quantity: string | null;
      min_quantity: string | null;
    }>;
  }> = [];

  for (let i = 1; i < skladRows.length; i++) {
    const row = skladRows[i];
    const boxName = row[1]?.trim();
    const itemName = row[2]?.trim();
    const minCount = row[3]?.trim() || null;
    // Sloupec "před T19" = index 6 (poslední)
    const predT19 = row[6]?.trim() || null;

    if (boxName) {
      currentBoxName = boxName;
    }

    if (!currentBoxName || !itemName) continue;

    // Najít nebo vytvořit krabici
    let boxData = boxesData.find(b => b.name === currentBoxName);
    if (!boxData) {
      boxData = { name: currentBoxName, items: [] };
      boxesData.push(boxData);
    }

    boxData.items.push({
      name: itemName,
      quantity: predT19,
      min_quantity: minCount,
    });
  }

  console.log(`  Nalezeno ${boxesData.length} krabic`);

  // 3. Vložit krabice a položky do DB
  console.log('\nVkládám do databáze...');
  let totalItems = 0;

  for (const boxData of boxesData) {
    // Najít sekci
    const sectionName = boxSectionMap.get(boxData.name.toLowerCase());
    const sectionId = sectionName ? sectionDbMap.get(sectionName) : null;

    // Vložit krabici
    const { data: box, error: boxError } = await supabase
      .from('boxes')
      .insert({
        name: boxData.name,
        section_id: sectionId || null,
        has_qr: true,
      })
      .select()
      .single();

    if (boxError) {
      console.error(`  ✗ Krabice "${boxData.name}":`, boxError.message);
      continue;
    }

    // Vložit položky
    const itemsToInsert = boxData.items.map(item => ({
      box_id: box.id,
      name: item.name,
      quantity: item.quantity,
      min_quantity: item.min_quantity,
      note: null,
    }));

    const { error: itemsError } = await supabase
      .from('items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error(`  ✗ Položky pro "${boxData.name}":`, itemsError.message);
    } else {
      totalItems += itemsToInsert.length;
      const sectionInfo = sectionName ? ` (${sectionName})` : '';
      console.log(`  ✓ "${boxData.name}"${sectionInfo} → ${itemsToInsert.length} položek`);
    }
  }

  console.log(`\n=== Import dokončen ===`);
  console.log(`  Sekce: ${sectionDbMap.size}`);
  console.log(`  Krabice: ${boxesData.length}`);
  console.log(`  Položky: ${totalItems}`);
}

main().catch(console.error);
