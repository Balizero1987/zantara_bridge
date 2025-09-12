import { google } from 'googleapis';

// =============================
// GOOGLE DRIVE
// =============================

export async function driveModifyFile(fileId: string, content: string, auth: any, mimeType = 'text/plain') {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.update({
    fileId,
    media: {
      mimeType,
      body: content,
    },
    fields: 'id,name,modifiedTime',
    supportsAllDrives: true,
  } as any);
  return res.data;
}

export async function driveShare(fileId: string, email: string, role: 'reader' | 'writer' | 'commenter', auth: any) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.permissions.create({
    fileId,
    requestBody: {
      role,
      type: 'user',
      emailAddress: email,
    },
    sendNotificationEmail: false,
    supportsAllDrives: true,
  } as any);
  return res.data;
}

export async function driveSearch(query: string, auth: any) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: query,
    fields: 'files(id,name,mimeType,webViewLink)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
  } as any);
  return res.data.files || [];
}

export async function driveRename(fileId: string, newName: string, auth: any) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id,name',
    supportsAllDrives: true,
  } as any);
  return res.data;
}

// =============================
// DRIVE FOLDER RESOLUTION
// =============================

export type DriveFolderRef = { id: string; name: string; driveId?: string | null; parents?: string[] | null };

export async function findFolderByName(name: string, auth: any): Promise<DriveFolderRef | null> {
  const drive = google.drive({ version: 'v3', auth });
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${name.replace(/'/g, "\\'")}'`,
  ].join(' and ');
  const { data } = await drive.files.list({
    q,
    fields: 'files(id,name,parents,driveId)',
    pageSize: 50,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
  } as any);
  const files = data.files || [];
  if (!files.length) return null;
  // Prefer a match inside configured shared drive, if provided
  const preferredDrive = process.env.ZANTARA_SHARED_DRIVE_ID;
  const chosen = preferredDrive ? (files.find(f => (f as any).driveId === preferredDrive) || files[0]) : files[0];
  return { id: chosen.id!, name: chosen.name!, driveId: (chosen as any).driveId || null, parents: (chosen as any).parents || null };
}

export async function findOrCreateChildFolder(parentId: string, name: string, auth: any): Promise<DriveFolderRef> {
  const drive = google.drive({ version: 'v3', auth });
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `'${parentId}' in parents`,
    `name = '${name.replace(/'/g, "\\'")}'`,
  ].join(' and ');
  const { data } = await drive.files.list({ q, fields: 'files(id,name,parents,driveId)', includeItemsFromAllDrives: true, supportsAllDrives: true } as any);
  if (data.files && data.files.length) {
    const f = data.files[0]!;
    return { id: f.id!, name: f.name!, driveId: (f as any).driveId || null, parents: (f as any).parents || null };
  }
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id,name,parents,driveId',
    supportsAllDrives: true,
  } as any);
  const f = created.data as any;
  return { id: f.id, name: f.name, driveId: f.driveId || null, parents: f.parents || null };
}

// Resolve a path like "AMBARADAM/BOSS/Notes". If createIfMissing=true, creates missing segments.
export async function resolveFolderPath(path: string, auth: any, createIfMissing = false): Promise<DriveFolderRef | null> {
  const segments = path.split('/').map(s => s.trim()).filter(Boolean);
  if (!segments.length) return null;
  const drive = google.drive({ version: 'v3', auth });

  // Resolve first segment across all drives, prefer configured shared drive
  let current: DriveFolderRef | null = await findFolderByName(segments[0], auth);
  if (!current && !createIfMissing) return null;
  if (!current && createIfMissing) {
    // Create at shared drive root if available, otherwise My Drive root
    const preferredDrive = process.env.ZANTARA_SHARED_DRIVE_ID || undefined;
    let parents: any = undefined;
    if (preferredDrive) {
      // Create under the shared drive root by specifying driveId and parents as the drive root via 'driveId' + 'supportsAllDrives'
      // Google API doesn't allow direct 'root' parent id for shared drives; omit parents to let it use the drive root when driveId+corpora provided in request.
      // Workaround: search any item in the drive to infer a parent; if not found, creation without parents still places it in user's My Drive.
      // We instead attempt to create without parents (Shared Drive admins commonly restrict this). Fallback to search again.
    }
    const created = await drive.files.create({
      requestBody: { name: segments[0], mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id,name,parents,driveId',
      supportsAllDrives: true,
    } as any);
    const f = created.data as any;
    current = { id: f.id, name: f.name, driveId: f.driveId || null, parents: f.parents || null };
  }

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (!current) return null;
    current = createIfMissing
      ? await findOrCreateChildFolder(current.id, seg, auth)
      : await (async () => {
          const q = [
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
            `'${current!.id}' in parents`,
            `name = '${seg.replace(/'/g, "\\'")}'`,
          ].join(' and ');
          const { data } = await drive.files.list({ q, fields: 'files(id,name,parents,driveId)', includeItemsFromAllDrives: true, supportsAllDrives: true } as any);
          const f = (data.files || [])[0];
          return f ? { id: f.id!, name: f.name!, driveId: (f as any).driveId || null, parents: (f as any).parents || null } : null;
        })();
  }
  return current;
}

// =============================
// GOOGLE CALENDAR
// =============================

export async function calendarList(auth: any, calendarId: string = 'primary', maxResults = 10) {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults,
  } as any);
  return res.data.items || [];
}

export async function calendarGet(eventId: string, calendarId: string, auth: any) {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.get({ calendarId, eventId } as any);
  return res.data;
}

export async function calendarQuickAdd(text: string, calendarId: string, auth: any) {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.quickAdd({ calendarId, text } as any);
  return res.data;
}

export async function calendarCancel(eventId: string, calendarId: string, auth: any) {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId, eventId } as any);
  return { success: true } as const;
}

// =============================
// GMAIL
// =============================

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function gmailDraft(to: string, subject: string, body: string, auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });
  const rawMime = `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${body}`;
  const raw = toBase64Url(rawMime);
  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });
  return res.data;
}

export async function gmailSend(to: string, subject: string, body: string, auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });
  const rawMime = `To: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${body}`;
  const raw = toBase64Url(rawMime);
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return res.data;
}

export async function gmailRead(query: string, auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({ userId: 'me', q: query });
  return res.data.messages || [];
}

export async function gmailReply(messageId: string, body: string, auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });
  // Fetch original to get threadId and headers
  const original = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata', metadataHeaders: ['Subject', 'Message-ID', 'References', 'From', 'To'] });
  const headers = (original.data.payload?.headers || []) as any[];
  const h = (name: string) => headers.find(x => x.name === name)?.value || '';
  const subject = h('Subject')?.startsWith('Re:') ? h('Subject') : `Re: ${h('Subject')}`.trim();
  const inReplyTo = h('Message-ID');
  const references = h('References');
  const to = h('From') || 'me';
  const rawMime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    references ? `References: ${references} ${inReplyTo}`.trim() : (inReplyTo ? `References: ${inReplyTo}` : ''),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].filter(Boolean).join('\r\n');
  const raw = toBase64Url(rawMime);
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId: original.data.threadId! } });
  return res.data;
}

// =============================
// PREVENT ZANTARA OVERREACH
// =============================

export function qualifyResponse(content: string, sourceConfidence: 'high' | 'low' | string) {
  if (sourceConfidence === 'high') {
    return `Zantara afferma: ${content}`;
  } else {
    return `Zantara ritiene: ${content}`;
  }
}

// =============================
// DISABLE EXTERNAL PROMPT REQUESTS
// =============================

export function validateAPIAccess(requestSource: string) {
  if (requestSource === 'external-prompt') {
    throw new Error('Richieste di approvazione esterne disabilitate per motivi di sicurezza.');
  }
  return true;
}
