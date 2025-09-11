import type { Router, Request, Response } from 'express';
import { getDriveClient } from '../../core/drive';
import { db } from '../../core/firestore';

export default function registerMemory(r: Router) {
  
  // ============================
  // SAVE TO MEMORY (Drive + Firestore)
  // ============================
  
  r.post('/api/memory/save', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { title, content, tags = [] } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({
          ok: false,
          error: 'missing_fields',
          detail: 'title and content are required'
        });
      }
      
      const ts = Date.now();
      const dateKey = new Date().toISOString().slice(0, 10);
      const filename = `${owner}-${dateKey}-${ts}.txt`;
      
      // Save to Firestore
      const noteData = {
        canonicalOwner: owner,
        title,
        content,
        tags,
        ts,
        dateKey
      };
      
      const docRef = await db.collection('notes').add(noteData);
      
      // Try to save to Drive (but don't fail if Drive fails)
      let driveFileId = null;
      let driveError = null;
      
      try {
        const drive = await getDriveClient();
        const folderId = process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
        
        if (folderId) {
          const fileContent = `Title: ${title}\nDate: ${new Date(ts).toISOString()}\nOwner: ${owner}\nTags: ${tags.join(', ')}\n\n${content}`;
          
          const driveResponse = await drive.files.create({
            requestBody: {
              name: filename,
              parents: [folderId]
            },
            media: {
              mimeType: 'text/plain',
              body: fileContent
            },
            fields: 'id,name,webViewLink',
            supportsAllDrives: true
          });
          
          driveFileId = driveResponse.data.id;
          
          // Update Firestore with Drive file ID
          await docRef.update({
            driveFileId,
            driveWebLink: driveResponse.data.webViewLink
          });
        }
      } catch (error: any) {
        driveError = error.message;
        console.warn('Drive save failed, but Firestore save succeeded:', error.message);
      }
      
      res.json({
        ok: true,
        firestoreId: docRef.id,
        driveFileId,
        driveError: driveError || undefined,
        owner,
        title,
        dateKey,
        ts
      });
      
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: 'memory_save_failed',
        detail: error.message
      });
    }
  });
  
  // ============================
  // SEARCH MEMORY
  // ============================
  
  r.get('/api/memory/search', async (req: Request, res: Response) => {
    try {
      const owner = (req as any).canonicalOwner || 'UNKNOWN';
      const { q, limit = 10 } = req.query;
      
      let query = db.collection('notes')
        .where('canonicalOwner', '==', owner)
        .orderBy('ts', 'desc')
        .limit(parseInt(String(limit), 10));
      
      const snapshot = await query.get();
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Simple text search if query provided
      let filtered = results;
      if (q) {
        const searchTerm = String(q).toLowerCase();
        filtered = results.filter((item: any) => 
          item.title?.toLowerCase().includes(searchTerm) ||
          item.content?.toLowerCase().includes(searchTerm) ||
          item.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm))
        );
      }
      
      res.json({
        ok: true,
        results: filtered,
        count: filtered.length,
        query: q || null
      });
      
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: 'memory_search_failed',
        detail: error.message
      });
    }
  });
}