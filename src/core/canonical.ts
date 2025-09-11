export function canonicalOwner(raw?: string | null): string {
  if (!raw) return 'UNKNOWN';
  return String(raw).trim().toUpperCase().replace(/\s+/g, '_');
}
