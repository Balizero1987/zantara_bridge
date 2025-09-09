export function canonicalOwner(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const nameOnly = s.replace(/@balizero\.com$/i, '').trim();
  const key = nameOnly.toLowerCase().replace(/[^a-z]/g, '');
  const MAP: Record<string, string> = {
    boss: 'BOSS', zero: 'BOSS',
    riri: 'RIRI', rina: 'RINA',
    gianluca: 'GIANLUCA', gl: 'GIANLUCA',
    ari: 'ARI', surya: 'SURYA', amanda: 'AMANDA'
  };
  return MAP[key] || nameOnly.toUpperCase();
}
