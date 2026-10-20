export function quantityNumber(value: string | null | undefined): number | null {
  if (value == null || !/^\d+([.,]\d+)?$/.test(value.trim())) return null;
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER ? n : null;
}

export function stockStatus(item: {
  quantity: string | null;
  min_quantity: string | null;
  lendings?: { quantity: string }[];
}) {
  const shelf = quantityNumber(item.quantity);
  const minimum = quantityNumber(item.min_quantity);
  const loans = (item.lendings || []).map((l) => quantityNumber(l.quantity));
  const lent = loans.some((n) => n === null) ? null : loans.reduce<number>((sum, n) => sum + n!, 0);
  const total = shelf === null || lent === null ? null : shelf + lent;
  return {
    shelf,
    minimum,
    lent,
    total,
    missing: total === null || minimum === null ? null : Math.max(0, minimum - total),
    recall:
      shelf === null || minimum === null || lent === null
        ? null
        : Math.min(lent, Math.max(0, minimum - shelf)),
  };
}

export function todayPrague() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date());
}

export interface Inventory {
  id: number;
  inventory_date: string;
  status: 'open' | 'closed';
  closed_at: string | null;
}
export interface InventoryEntry {
  id: number;
  inventory_id: number;
  item_id: number;
  item_name: string;
  box_id: number;
  box_name: string;
  item_type: string;
  minimum: string | null;
  expected_total: number | null;
  counted: number | null;
  lent: number | null;
  lending_snapshot: { lent_to: string; quantity: string }[] | null;
  checked_date: string | null;
  checked_at: string | null;
  original_quantity: string | null;
  legacy_quantity: string | null;
  original_note: string | null;
}
