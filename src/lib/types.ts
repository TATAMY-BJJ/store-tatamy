export interface Section {
  id: number;
  name: string;
  responsible_person: string | null;
  color: string | null;
  created_at: string;
}

/** Predefined color palette for sections (15 colors) */
export const SECTION_COLORS = [
  { value: '#1e1e1e', label: 'Černá' },
  { value: '#dc2626', label: 'Červená' },
  { value: '#ea580c', label: 'Oranžová' },
  { value: '#d97706', label: 'Jantarová' },
  { value: '#ca8a04', label: 'Žlutá' },
  { value: '#16a34a', label: 'Zelená' },
  { value: '#059669', label: 'Smaragdová' },
  { value: '#0d9488', label: 'Tyrkysová' },
  { value: '#0284c7', label: 'Modrá' },
  { value: '#2563eb', label: 'Královská modrá' },
  { value: '#4f46e5', label: 'Indigo' },
  { value: '#7c3aed', label: 'Fialová' },
  { value: '#9333ea', label: 'Purpurová' },
  { value: '#db2777', label: 'Růžová' },
  { value: '#e11d48', label: 'Malinová' },
] as const;

export interface Box {
  id: number;
  name: string;
  section_id: number | null;
  has_qr: boolean;
  created_at: string;
  section?: Section;
  items?: Item[];
}

export interface Lending {
  id: number;
  item_id: number;
  lent_to: string;
  quantity: string;
  note: string | null;
  created_at: string;
}

export interface Item {
  id: number;
  box_id: number;
  name: string;
  quantity: string | null;
  min_quantity: string | null;
  item_type?: "unclassified" | "asset" | "consumable";
  last_checked_at?: string | null;
  last_checked_date?: string | null;
  legacy_quantity?: string | null;
  note: string | null;
  created_at: string;
  lendings?: Lending[];
}

export interface AlertItem extends Item {
  box_name: string;
  section_name: string | null;
}

// Pomocné funkce pro porovnání počtů
export function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const num = Number(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export function isbelowMinimum(quantity: string | null, minQuantity: string | null): boolean {
  const qty = parseNumericValue(quantity);
  const minQty = parseNumericValue(minQuantity);
  if (qty === null || minQty === null) return false;
  return qty < minQty;
}
