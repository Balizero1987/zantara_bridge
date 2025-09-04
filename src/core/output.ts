export function ok(data: any) {
  return { ok: true, data };
}
export function fail(msg: string, details?: any) {
  return { ok: false, error: msg, details: details || null };
}
