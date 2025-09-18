import { Request, Response, Router } from 'express';
import { driveAsUser } from '../core/impersonation';

const router = Router();

// POST /api/search/drive - Enhanced with impersonation support
router.post('/drive', async (req: Request, res: Response) => {
  const {
    query = '',
    fileType,
    modifiedAfter,
    folderId,
    includeFiles = true,
    includeFolders = true,
    driveId,
  } = req.body || {};

  try {
    const drive = driveAsUser();
    
    let qParts: string[] = [];
    if (folderId) qParts.push(`'${folderId}' in parents`);
    if (!includeFolders) qParts.push(`mimeType != 'application/vnd.google-apps.folder'`);
    if (!includeFiles) qParts.push(`mimeType = 'application/vnd.google-apps.folder'`);
    if (fileType) qParts.push(`mimeType = '${fileType}'`);
    if (modifiedAfter) qParts.push(`modifiedTime > '${modifiedAfter}'`);
    if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
    
    const q = qParts.length ? qParts.join(' and ') : undefined;
    
    const { data } = await drive.files.list({
      q,
      fields: 'files(id,name,mimeType,webViewLink,createdTime,parents)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(driveId ? { corpora: 'drive', driveId } : { corpora: 'allDrives' }),
      pageSize: 1000
    } as any);
    
    const files = (data as any).files || [];
    res.json({
      files,
      count: files.length,
      query: query || (folderId ? 'all-in-folder' : 'all'),
      userId: process.env.IMPERSONATE_USER || 'impersonated'
    });
  } catch (error: any) {
    console.error('Drive search error:', error);
    res.status(500).json({ 
      files: [], 
      count: 0, 
      error: error?.message || String(error) 
    });
  }
});

// GET /api/search/recent
router.get('/recent', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 5;
  
  try {
    const drive = driveAsUser();
    
    const { data } = await drive.files.list({
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      pageSize: limit
    } as any);
    
    res.json({
      recentFiles: (data as any).files || [],
      count: (data as any).files?.length || 0
    });
    
  } catch (error: any) {
    console.error('Recent files error:', error);
    res.status(500).json({ 
      error: 'Failed to get recent files',
      details: error.message 
    });
  }
});

// GET /api/search/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const drive = driveAsUser();
    
    const { data } = await drive.files.list({
      fields: 'files(id,name,mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      pageSize: 1000
    } as any);
    
    const allFiles = (data as any).files || [];
    
    const stats = {
      totalFiles: allFiles.length,
      fileTypes: {} as { [key: string]: number },
      userFiles: {} as { [key: string]: number }
    };
    
    allFiles.forEach(file => {
      // Count file types
      const mimeType = file.mimeType || 'unknown';
      stats.fileTypes[mimeType] = (stats.fileTypes[mimeType] || 0) + 1;
      
      // Count files per user (extract from filename)
      const fileName = file.name || '';
      const userMatch = fileName.match(/^([^_]+)_/);
      if (userMatch) {
        const user = userMatch[1];
        stats.userFiles[user] = (stats.userFiles[user] || 0) + 1;
      }
    });
    
    res.json(stats);
    
  } catch (error: any) {
    console.error('Drive stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      details: error.message 
    });
  }
});

export { router as searchRouter };