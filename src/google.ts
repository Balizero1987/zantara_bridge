import { google } from 'googleapis';
// Returns an authenticated client that impersonates a Workspace user via DWD
export async function impersonatedClient(user: string, scopes: string[]): Promise<{ auth: any }> {
  const subject = (user || '').trim();
  try {
    const auth = await google.auth.getClient({
      scopes,
      // @ts-ignore subject passthrough
      clientOptions: subject ? { subject } : undefined,
    });
    return { auth };
  } catch {}
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY or ADC for impersonation');
  const auth = new google.auth.JWT({ email, key, scopes, subject: subject || undefined });
  await (auth as any).authorize();
  return { auth };
}
