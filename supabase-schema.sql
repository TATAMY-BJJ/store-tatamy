-- ============================================
-- TATAMY Sklad - Supabase Database Schema
-- ============================================
-- Spusťte tento SQL ve Supabase SQL editoru

-- Tabulka sekcí
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  responsible_person TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabulka krabic
CREATE TABLE boxes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  has_qr BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabulka položek
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  box_id INTEGER NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  min_quantity TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabulka výpůjček (kdo má co půjčeno)
CREATE TABLE lendings (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  lent_to TEXT NOT NULL,
  quantity TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexy pro rychlé dotazy
CREATE INDEX idx_boxes_section_id ON boxes(section_id);
CREATE INDEX idx_items_box_id ON items(box_id);
CREATE INDEX idx_lendings_item_id ON lendings(item_id);

-- Row Level Security - VYPNUTÁ (veřejný přístup ke čtení, auth řešíme v aplikaci)
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Politiky pro veřejný přístup ke čtení
CREATE POLICY "Public read sections" ON sections FOR SELECT USING (true);
CREATE POLICY "Public read boxes" ON boxes FOR SELECT USING (true);
CREATE POLICY "Public read items" ON items FOR SELECT USING (true);
CREATE POLICY "Public read lendings" ON lendings FOR SELECT USING (true);

-- Politiky pro zápis přes service role (API klíč na serveru)
CREATE POLICY "Service write sections" ON sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write boxes" ON boxes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write lendings" ON lendings FOR ALL USING (true) WITH CHECK (true);
