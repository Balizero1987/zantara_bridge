import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';
import { DriveCache } from '../cache/driveCache';
import { redisClient } from '../lib/redis';

class DriveService {
  private drive: any;
  private auth: GoogleAuth;
  private initialized = false;
  private AMBARADAM_FOLDER_ID = '';
  private driveCache = new DriveCache(redisClient);

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const authClient = await this.auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: authClient as any });
      
      // Trova o crea la cartella AMBARADAM
      await this.setupAMBARADAMFolder();
      
      this.initialized = true;
      console.log('✅ Google Drive service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
      throw error;
    }
  }

  private async setupAMBARADAMFolder() {
    try {
      // Cerca la cartella AMBARADAM esistente
      const response = await this.drive.files.list({
        q: "name='AMBARADAM' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        this.AMBARADAM_FOLDER_ID = response.data.files[0].id;
        console.log(`📁 Found AMBARADAM folder: ${this.AMBARADAM_FOLDER_ID}`);
      } else {
        // Crea la cartella se non esiste
        const folderMetadata = {
          name: 'AMBARADAM',
          mimeType: 'application/vnd.google-apps.folder',
        };
        
        const folder = await this.drive.files.create({
          resource: folderMetadata,
          fields: 'id',
        });
        
        this.AMBARADAM_FOLDER_ID = folder.data.id;
        console.log(`📁 Created AMBARADAM folder: ${this.AMBARADAM_FOLDER_ID}`);
      }
      
      // Crea sottocartelle
      await this.createSubfolders();
    } catch (error) {
      console.error('Error setting up AMBARADAM folder:', error);
      throw error;
    }
  }

  private async createSubfolders() {
    const subfolders = ['conversations', 'documents', 'knowledge', 'analytics'];
    
    for (const subfolder of subfolders) {
      try {
        const response = await this.drive.files.list({
          q: `name='${subfolder}' and '${this.AMBARADAM_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
        });

        if (!response.data.files || response.data.files.length === 0) {
          await this.drive.files.create({
            resource: {
              name: subfolder,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [this.AMBARADAM_FOLDER_ID],
            },
            fields: 'id',
          });
          console.log(`📂 Created subfolder: ${subfolder}`);
        }
      } catch (error) {
        console.error(`Error creating subfolder ${subfolder}:`, error);
      }
    }
  }

  async uploadFile(
    fileName: string,
    content: string | Buffer,
    mimeType: string = 'text/plain',
    subfolder: string = 'documents'
  ): Promise<string> {
    await this.initialize();
    
    try {
      // Trova la sottocartella
      const subfolderResponse = await this.drive.files.list({
        q: `name='${subfolder}' and '${this.AMBARADAM_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
      });
      
      const parentId = subfolderResponse.data.files?.[0]?.id || this.AMBARADAM_FOLDER_ID;
      
      // Prepara il contenuto
      const stream = Readable.from(Buffer.isBuffer(content) ? content : Buffer.from(content));
      
      const fileMetadata = {
        name: fileName,
        parents: [parentId],
      };
      
      const media = {
        mimeType: mimeType,
        body: stream,
      };
      
      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });
      
      // Invalidate cache after upload
      try {
        await this.driveCache.invalidateFolder('root');
        if (subfolder) {
          await this.driveCache.invalidateFolder(subfolder);
        }
        console.log('📋 Cache invalidated after file upload');
      } catch (cacheError) {
        console.warn('Cache invalidation error:', cacheError);
      }

      console.log(`✅ File uploaded: ${fileName} (${file.data.id})`);
      return file.data.webViewLink || file.data.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async saveConversation(userId: string, messages: any[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `conversation_${userId}_${timestamp}.json`;
    const content = JSON.stringify(messages, null, 2);
    
    return await this.uploadFile(fileName, content, 'application/json', 'conversations');
  }

  async listFiles(subfolder?: string): Promise<any[]> {
    const cacheKey = subfolder || 'root';

    // Try cache first
    try {
      const cached = await this.driveCache.getCachedFolderList(cacheKey);
      if (cached) {
        console.log('📋 Cache HIT: Drive listFiles');
        return cached;
      }
    } catch (cacheError) {
      console.warn('Cache read error (continuing without cache):', cacheError);
    }

    // Original logic here...
    const files = await this.originalListFilesLogic(subfolder);

    // Cache the results
    try {
      await this.driveCache.setCachedFolderList(cacheKey, files);
      console.log('📋 Cache MISS: Drive listFiles cached');
    } catch (cacheError) {
      console.warn('Cache write error (continuing without cache):', cacheError);
    }

    return files;
  }

  private async originalListFilesLogic(subfolder?: string): Promise<any[]> {
    await this.initialize();
    
    try {
      let query = `'${this.AMBARADAM_FOLDER_ID}' in parents and trashed=false`;
      
      if (subfolder) {
        const subfolderResponse = await this.drive.files.list({
          q: `name='${subfolder}' and '${this.AMBARADAM_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
        });
        
        const subfolderId = subfolderResponse.data.files?.[0]?.id;
        if (subfolderId) {
          query = `'${subfolderId}' in parents and trashed=false`;
        }
      }
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink, size)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
      });
      
      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async getFile(fileId: string): Promise<any> {
    // Try cache first for file metadata
    try {
      const cached = await this.driveCache.getCachedFileInfo(fileId);
      if (cached) {
        console.log('📋 Cache HIT: Drive getFile metadata');
        return cached;
      }
    } catch (cacheError) {
      console.warn('Cache read error (continuing without cache):', cacheError);
    }

    await this.initialize();
    
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
      
      const fileData = response.data;

      // Cache the file metadata
      try {
        await this.driveCache.setCachedFileInfo(fileId, fileData);
        console.log('📋 Cache MISS: Drive getFile cached');
      } catch (cacheError) {
        console.warn('Cache write error (continuing without cache):', cacheError);
      }
      
      return fileData;
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
      
      // Invalidate cache after deletion
      try {
        await this.driveCache.invalidateFile(fileId);
        await this.driveCache.invalidateFolder('root'); // Invalidate folder listings
        console.log('📋 Cache invalidated for deleted file');
      } catch (cacheError) {
        console.warn('Cache invalidation error:', cacheError);
      }
      
      console.log(`🗑️ File deleted: ${fileId}`);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async searchFiles(query: string): Promise<any[]> {
    // Try cache first for search results
    try {
      const cached = await this.driveCache.getCachedSearch(query);
      if (cached) {
        console.log('📋 Cache HIT: Drive searchFiles');
        return cached;
      }
    } catch (cacheError) {
      console.warn('Cache read error (continuing without cache):', cacheError);
    }

    await this.initialize();
    
    try {
      const response = await this.drive.files.list({
        q: `fullText contains '${query}' and '${this.AMBARADAM_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 50,
      });
      
      const results = response.data.files || [];

      // Cache the search results
      try {
        await this.driveCache.setCachedSearch(query, results);
        console.log('📋 Cache MISS: Drive searchFiles cached');
      } catch (cacheError) {
        console.warn('Cache write error (continuing without cache):', cacheError);
      }
      
      return results;
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async generateDoc(owner: string, title: string, content: string): Promise<any> {
    await this.initialize();
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Report_AMBARADAM_${title}_${timestamp}.txt`;
      
      const result = await this.uploadFile(fileName, content, 'text/plain', 'documents');
      
      console.log(`✅ Document generated: ${fileName}`);
      return {
        id: result,
        webViewLink: result,
        fileName: fileName
      };
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }
}

export const driveService = new DriveService();

// Export convenience function for backwards compatibility
export async function generateDoc(owner: string, title: string, content: string): Promise<any> {
  return await driveService.generateDoc(owner, title, content);
}