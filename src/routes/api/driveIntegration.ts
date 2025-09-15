import { Router } from 'express';
import { driveService } from '../../services/driveService';

export default function registerDriveIntegration(router: Router) {
  
  // Upload file to Drive
  router.post('/api/drive/upload', async (req, res) => {
    try {
      const { fileName, content, mimeType, subfolder, base64 } = req.body;
      
      if (!fileName || !content) {
        return res.status(400).json({ 
          ok: false, 
          error: 'fileName and content are required' 
        });
      }
      
      // Handle base64 encoded content
      const fileContent = base64 
        ? Buffer.from(content, 'base64')
        : content;
      
      const link = await driveService.uploadFile(
        fileName,
        fileContent,
        mimeType || 'text/plain',
        subfolder || 'documents'
      );
      
      return res.json({ 
        ok: true, 
        link,
        message: `File ${fileName} uploaded successfully` 
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to upload file' 
      });
    }
  });
  
  // Save conversation to Drive
  router.post('/api/drive/conversation', async (req, res) => {
    try {
      const userId = (req as any).canonicalOwner || 'anonymous';
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ 
          ok: false, 
          error: 'messages array is required' 
        });
      }
      
      const link = await driveService.saveConversation(userId, messages);
      
      return res.json({ 
        ok: true, 
        link,
        message: 'Conversation saved to Drive' 
      });
    } catch (error: any) {
      console.error('Save conversation error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to save conversation' 
      });
    }
  });
  
  // List files from Drive
  router.get('/api/drive/files', async (req, res) => {
    try {
      const { subfolder } = req.query;
      const files = await driveService.listFiles(subfolder as string);
      
      return res.json({ 
        ok: true, 
        files,
        count: files.length 
      });
    } catch (error: any) {
      console.error('List files error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to list files' 
      });
    }
  });
  
  // Get specific file content
  router.get('/api/drive/file/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return res.status(400).json({ 
          ok: false, 
          error: 'fileId is required' 
        });
      }
      
      const content = await driveService.getFile(fileId);
      
      return res.json({ 
        ok: true, 
        content 
      });
    } catch (error: any) {
      console.error('Get file error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to get file' 
      });
    }
  });
  
  // Delete file from Drive
  router.delete('/api/drive/file/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return res.status(400).json({ 
          ok: false, 
          error: 'fileId is required' 
        });
      }
      
      await driveService.deleteFile(fileId);
      
      return res.json({ 
        ok: true, 
        message: 'File deleted successfully' 
      });
    } catch (error: any) {
      console.error('Delete file error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to delete file' 
      });
    }
  });
  
  // Search files in Drive
  router.get('/api/drive/search', async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ 
          ok: false, 
          error: 'query parameter is required' 
        });
      }
      
      const files = await driveService.searchFiles(query as string);
      
      return res.json({ 
        ok: true, 
        files,
        count: files.length 
      });
    } catch (error: any) {
      console.error('Search files error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to search files' 
      });
    }
  });
  
  // Save KITAS/TAX/PT PMA knowledge
  router.post('/api/drive/knowledge', async (req, res) => {
    try {
      const { type, title, content, metadata } = req.body;
      
      if (!type || !title || !content) {
        return res.status(400).json({ 
          ok: false, 
          error: 'type, title, and content are required' 
        });
      }
      
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${type}_${title.replace(/\s+/g, '_')}_${timestamp}.json`;
      
      const documentContent = JSON.stringify({
        type,
        title,
        content,
        metadata,
        createdAt: new Date().toISOString(),
        createdBy: (req as any).canonicalOwner || 'system'
      }, null, 2);
      
      const link = await driveService.uploadFile(
        fileName,
        documentContent,
        'application/json',
        'knowledge'
      );
      
      return res.json({ 
        ok: true, 
        link,
        message: `Knowledge document ${title} saved successfully` 
      });
    } catch (error: any) {
      console.error('Save knowledge error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to save knowledge' 
      });
    }
  });
  
  // Generate analytics report
  router.post('/api/drive/analytics', async (req, res) => {
    try {
      const { reportType, data, period } = req.body;
      
      if (!reportType || !data) {
        return res.status(400).json({ 
          ok: false, 
          error: 'reportType and data are required' 
        });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `report_${reportType}_${period || 'current'}_${timestamp}.json`;
      
      const reportContent = JSON.stringify({
        reportType,
        period,
        data,
        generatedAt: new Date().toISOString(),
        generatedBy: (req as any).canonicalOwner || 'system'
      }, null, 2);
      
      const link = await driveService.uploadFile(
        fileName,
        reportContent,
        'application/json',
        'analytics'
      );
      
      return res.json({ 
        ok: true, 
        link,
        message: `Analytics report ${reportType} generated successfully` 
      });
    } catch (error: any) {
      console.error('Generate analytics error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: error.message || 'Failed to generate analytics' 
      });
    }
  });
}