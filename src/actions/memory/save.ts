import { Request, Response } from 'express';
import { Readable } from 'stream';
import { driveAsUser } from '../../core/impersonation';

type Body = { title: string; content: string; tags?: string[] };

function tsLabel(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function memorySaveHandler(req: Request, res: Response) {
  try {
    const { title, content, tags, folderId, driveId: driveIdBody, supportsAllDrives = true } = req.body || {};
    if (!title || !content) return res.status(400).json({ ok: false, error: 'Missing title/content' });
    
    // Support for Shared Drive from patch
    const defaultDriveId = process.env.SHARED_DRIVE_MEMORY_ID; // 0AJC3-SJL03OOUk9PVA
    const driveId = driveIdBody || defaultDriveId;
    
    // Use path-based folder resolution with DEFAULT_FOLDER_ROOT if no driveId
    const owner = (req as any).canonicalOwner || 'BOSS';
    const rootFolder = process.env.DEFAULT_FOLDER_ROOT || 'AMBARADAM';
    const folderPath = driveId ? 'MEMORY' : `${rootFolder}/${owner}/Notes`;

    const safeTitle = String(title).trim().replace(/\s+/g, '-');
    const name = `${tsLabel()}_${safeTitle}.md`;
    const timestamp = new Date().toISOString();
    const tagsLine = (Array.isArray(tags) && tags.length) ? `Tags: ${tags.map(t => `#${String(t).trim().replace(/\s+/g, '-')}`).join(' ')}` : '';
    const md = `# ${title}\n[${timestamp}]\n${tagsLine}\n\n${content}\n`;

    // Use centralized impersonation
    const drive = driveAsUser();
    const stream = Readable.from(Buffer.from(md, 'utf8'));
    
    // If driveId is provided, ensure folder exists in Shared Drive
    let parentId = folderId;
    if (driveId && !folderId) {
      // Ensure MEMORY folder exists in Shared Drive root
      const folderName = "MEMORY";
      const { data: searchData } = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${driveId}' in parents and trashed=false`,
        fields: "files(id,name)",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: "drive",
        driveId,
      } as any);
      const found = (searchData as any).files?.[0];
      if (found) {
        parentId = found.id;
      } else {
        const { data: created } = await drive.files.create({
          requestBody: { 
            name: folderName, 
            mimeType: "application/vnd.google-apps.folder", 
            parents: [driveId]
          },
          fields: "id",
          supportsAllDrives: true,
        } as any);
        parentId = (created as any).id;
      }
    }
    
    const { data } = await drive.files.create({
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
        ...(driveId ? { driveId } : {}),
      },
      media: { mimeType: "text/markdown", body: stream },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    } as any);
    (req as any).log?.info?.({ action: 'memory.save', id: (data as any)?.id, name: (data as any)?.name });
    return res.json({ id: (data as any)?.id, name: (data as any)?.name });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const gerr = e?.response?.data || null;
    (req as any).log?.error?.({ action: 'memory.save', error: e?.message || String(e), status, gerr });
    return res.status(status).json({ ok: false, error: e?.message || 'memory.save failed', details: gerr || undefined });
  }
}

