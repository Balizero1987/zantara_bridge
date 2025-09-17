import { google } from 'googleapis';

export function getGoogleAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY non trovato');
  }

  let key: any;
  try {
    key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY non è un JSON valido');
  }

  return new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
    process.env.IMPERSONATE_USER
  );
}