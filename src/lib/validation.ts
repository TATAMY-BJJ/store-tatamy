export function isValidId(id: string): boolean {
  const num = Number(id);
  return Number.isInteger(num) && num > 0;
}

export function sanitizeString(value: unknown, maxLength: number = 500): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength) || null;
}

export function requireString(value: unknown, maxLength: number = 500): string | null {
  const s = sanitizeString(value, maxLength);
  return s && s.length > 0 ? s : null;
}

/**
 * Sanitize a CSV cell value to prevent CSV injection.
 * Prefixes cells starting with =, +, -, @ with a single quote.
 */
export function sanitizeCsvCell(value: string): string {
  if (value.length > 0 && ['=', '+', '-', '@'].includes(value[0])) {
    return "'" + value;
  }
  return value;
}
