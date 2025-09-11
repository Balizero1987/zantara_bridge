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
  const driveId = (process.env.DRIVE_ID_AMBARADAM || '').trim() || undefined;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id,name,mimeType,webViewLink)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: driveId ? 'drive' : 'allDrives',
    driveId,
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
