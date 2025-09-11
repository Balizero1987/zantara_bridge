import { google } from "googleapis";

/**
 * Helpers per gestire sia My Drive che Shared Drive.
 * Se presenti, usiamo TEST_SUBJECT / TEST_DRIVE_ID (deploy diagnostici).
 * In fallback, usiamo DRIVE_SUBJECT / DRIVE_ID_AMBARADAM (config classica).
 */

// ===== Utility env =====
export function getSharedDriveId(): string | null {
  const id =
    (process.env.TEST_DRIVE_ID ||
      process.env.DRIVE_ID_AMBARADAM ||
      "").trim();
  return id || null;
}

export function getDriveSubject(): string | null {
  return (
    (process.env.TEST_SUBJECT || process.env.DRIVE_SUBJECT || "").trim() || null
  );
}

// ===== Helpers Shared Drive =====
export function listInSharedDriveParams(overrides: any = {}): any {
  const driveId = getSharedDriveId();
  return {
    corpora: driveId ? "drive" : "allDrives",
    driveId: driveId || undefined,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    ...overrides,
  };
}

export function withAllDrives<T extends Record<string, any>>(
  overrides: T
): T & { supportsAllDrives: true } {
  return { supportsAllDrives: true, ...overrides } as any;
}

export function ensureParentsInSharedDrive(
  parents?: string[] | null
): string[] | undefined {
  const driveId = getSharedDriveId();
  const list = Array.isArray(parents) ? parents.slice() : [];
  if (driveId && !list.includes(driveId)) list.unshift(driveId);
  return list.length ? list : undefined;
}

// ===== Diagnostica / whoami =====
export async function whoami() {
  const auth = await google.auth.getClient({
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: getDriveSubject() || undefined,
  });
  const drive = google.drive({ version: "v3", auth });

  const about = await drive.about.get({
    fields: "user, storageQuota",
  } as any);

  const sharedId = getSharedDriveId();
  let sample: any[] | undefined;
  let driveMeta: any | undefined;

  if (sharedId) {
    try {
      // Metadata dello Shared Drive
      const d = await (drive as any).drives.get({ driveId: sharedId });
      driveMeta = d.data;
      // Prova a listare un file
      const lst = await drive.files.list({
        pageSize: 1,
        fields: "files(id,name)",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: "drive",
        driveId: sharedId,
        q: "trashed=false",
      } as any);
      sample = lst.data.files || [];
    } catch (e: any) {
      // Fallback: My Drive
      const lst = await drive.files.list({
        pageSize: 1,
        fields: "files(id,name)",
        q: "trashed=false",
      } as any);
      sample = lst.data.files || [];
      driveMeta = { id: sharedId, error: e?.message || "forbidden" };
    }
  } else {
    // Nessun Shared Drive configurato → My Drive
    const lst = await drive.files.list({
      pageSize: 1,
      fields: "files(id,name)",
      q: "trashed=false",
    } as any);
    sample = lst.data.files || [];
  }

  return {
    ok: true,
    about: about.data,
    sample,
    drive: driveMeta,
    user: about.data.user,
    impersonating: getDriveSubject(),
  };
}
