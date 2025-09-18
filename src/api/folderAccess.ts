/**
 * API endpoints per testare l'accesso OAuth alla cartella Drive
 */

import express, { Request, Response } from 'express';
import { testFolderAccess, checkDelegationSetup, createTestFile, TARGET_FOLDER_ID } from '../utils/folderAccess';

const router = express.Router();

/**
 * GET /api/folder-access/test/:folderId?
 * Test accesso a cartella specifica o default
 */
router.get('/test/:folderId?', async (req: Request, res: Response) => {
  try {
    const folderId = req.params.folderId || TARGET_FOLDER_ID;
    const subject = req.query.subject as string;
    
    console.log(`Testing folder access: ${folderId} with subject: ${subject || 'default'}`);
    
    const result = await testFolderAccess(folderId, subject);
    
    res.json({
      folderId,
      subject: subject || process.env.IMPERSONATE_USER || 'none',
      timestamp: new Date().toISOString(),
      ...result
    });
    
  } catch (error: any) {
    console.error('Folder access test error:', error);
    res.status(500).json({
      error: 'Folder access test failed',
      message: error.message
    });
  }
});

/**
 * GET /api/folder-access/status
 * Verifica stato configurazione OAuth delegation
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await checkDelegationSetup();
    
    res.json({
      timestamp: new Date().toISOString(),
      targetFolder: TARGET_FOLDER_ID,
      environment: {
        hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        impersonateUser: process.env.IMPERSONATE_USER || null,
        projectId: process.env.GOOGLE_CLOUD_PROJECT || null
      },
      ...status
    });
    
  } catch (error: any) {
    console.error('OAuth delegation status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

/**
 * POST /api/folder-access/create-test
 * Crea file di test nella cartella per verificare permessi di scrittura
 */
router.post('/create-test', async (req: Request, res: Response) => {
  try {
    const { content, filename, folderId } = req.body;
    
    const result = await createTestFile(
      content || `OAuth test file created at ${new Date().toISOString()}`,
      filename || `oauth-test-${Date.now()}.txt`,
      folderId || TARGET_FOLDER_ID
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test file created successfully',
        fileId: result.fileId,
        folderId: folderId || TARGET_FOLDER_ID
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error: any) {
    console.error('Test file creation error:', error);
    res.status(500).json({
      error: 'Test file creation failed',
      message: error.message
    });
  }
});

/**
 * GET /api/folder-access/config
 * Mostra configurazione corrente e istruzioni per setup
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    // Ottieni Client ID dal Service Account (se disponibile)
    let clientId = 'N/A';
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        // Estrai il numeric ID dall'email del service account
        clientId = sa.client_id || 'Check in Google Cloud Console';
      }
    } catch (e) {
      console.log('Could not parse service account key');
    }

    res.json({
      targetFolder: TARGET_FOLDER_ID,
      currentConfig: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 
          JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).client_email : 'N/A',
        impersonateUser: process.env.IMPERSONATE_USER,
        clientId
      },
      setupInstructions: {
        step1: 'Enable Domain-wide Delegation for service account in Google Cloud Console',
        step2: 'Configure OAuth scopes in Google Admin Console',
        adminConsoleUrl: 'https://admin.google.com/ac/owl/domainwidedelegation',
        requiredScopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata'
        ],
        testEndpoints: {
          'Test folder access': 'GET /api/folder-access/test',
          'Check delegation status': 'GET /api/folder-access/status',
          'Create test file': 'POST /api/folder-access/create-test'
        }
      }
    });
    
  } catch (error: any) {
    console.error('Config endpoint error:', error);
    res.status(500).json({
      error: 'Configuration retrieval failed',
      message: error.message
    });
  }
});

export default router;