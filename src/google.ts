// Minimal stub for impersonatedClient to unblock tests
export async function impersonatedClient(user: string, scopes: string[]): Promise<{ auth: any }> {
  return { auth: {} };
}
