import { google } from 'googleapis';

// Real implementation for domain-wide delegation or SA-only access.
// - If `user` is provided and DWD is configured, requests run as that user (subject).
// - Otherwise, uses the service account identity directly (must be a member of the Shared Drive).
export async function impersonatedClient(user: string, scopes: string[]): Promise<{ auth: any }> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  let clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '';
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (raw && raw.trim()) {
    try {
      const creds = JSON.parse(raw);
      clientEmail = creds.client_email || clientEmail;
      privateKey = creds.private_key || privateKey;
    } catch {
      // ignore malformed JSON; fall back to env parts
    }
  }

  // Normalize escaped newlines if coming from env var
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY');
  }

  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject: (user || '').trim() || undefined,
  } as any);

  // Proactively fetch a token to surface DWD errors early
  try { await jwt.authorize(); } catch (e) { /* let callers handle */ }
  return { auth: jwt };
}
