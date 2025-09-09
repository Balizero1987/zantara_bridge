import { JWT } from "google-auth-library";
import { google } from "googleapis";

export async function getDriveClient() {
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const subjectUser = process.env.DRIVE_SUBJECT;

  if (!saKey || !subjectUser) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY or DRIVE_SUBJECT");
  }

  const creds = JSON.parse(saKey);

  const jwtClient = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    subject: subjectUser,  // 👈 impersonation
  });

  await jwtClient.authorize();

  const drive = google.drive({ version: "v3", auth: jwtClient });
  return drive;
}
