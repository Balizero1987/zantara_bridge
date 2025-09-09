export function canonicalOwner(raw?: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}
