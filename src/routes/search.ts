import { Request, Response, Router } from 'express';
import { listDriveFiles } from '../services/driveUpload';

const router = Router();

// POST /api/search/drive
router.post('/drive', async (req: Request, res: Response) => {
  const { userId, query, limit = 10 } = req.body;
  
  try {
    const files = await listDriveFiles(userId, limit);
    
    let filteredFiles = files;
    
    // Apply text search filter if query provided
    if (query) {
      filteredFiles = files.filter(file => 
        file.name?.toLowerCase().includes(query.toLowerCase()) ||
        file.mimeType?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    res.json({
      files: filteredFiles,
      count: filteredFiles.length,
      query: query || 'all',
      userId: userId || 'all'
    });
    
  } catch (error: any) {
    console.error('Drive search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      details: error.message 
    });
  }
});

// GET /api/search/recent
router.get('/recent', async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const limit = parseInt(req.query.limit as string) || 5;
  
  try {
    const files = await listDriveFiles(userId, limit);
    
    res.json({
      recentFiles: files,
      count: files.length
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
    const allFiles = await listDriveFiles(undefined, 100);
    
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