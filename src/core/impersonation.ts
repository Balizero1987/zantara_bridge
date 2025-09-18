import { google } from "googleapis";
import { JWT } from "google-auth-library";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function getSaCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
  try { 
    return JSON.parse(raw); 
  } catch { 
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON"); 
  }
}

export function buildJwt(scopes: string[] = [DRIVE_SCOPE], subject?: string) {
  const creds = getSaCredentials();
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
    // Se subject non passato, usa IMPERSONATE_USER
    subject: subject || process.env.IMPERSONATE_USER || 'zero@balizero.com',
  });
}

/** 
 * Restituisce SEMPRE un client Drive impersonato (se IMPERSONATE_USER è settato) 
 * Questo è il metodo principale da usare ovunque
 */
export function driveAsUser(subject?: string) {
  const auth = buildJwt([DRIVE_SCOPE], subject);
  return google.drive({ version: "v3", auth: auth as any });
}

/** 
 * Fallback, raramente utile: Service Account "nudo" (senza subject) 
 * Da usare SOLO per operazioni tecniche che non richiedono quota
 */
export function driveAsServiceAccount() {
  const creds = getSaCredentials();
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [DRIVE_SCOPE],
    // NO subject here - raw service account
  });
  return google.drive({ version: "v3", auth: auth as any });
}

/**
 * Helper per generare docx (già esistente nel tuo codice)
 */
export async function generateBriefDocx(params: {
  topic: string;
  details: string;
  template?: string;
}): Promise<string> {
  // Placeholder - usa la tua implementazione esistente
  const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
  
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: params.topic,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: params.details,
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer.toString('base64');
}