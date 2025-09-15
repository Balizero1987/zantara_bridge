/**
 * ZANTARA Bridge - Google Apps Script Drive Integration
 * Deploy questo file su script.google.com come Web App
 * 
 * 1. Vai su script.google.com
 * 2. Crea nuovo progetto "ZANTARA-Bridge-Drive"
 * 3. Incolla questo codice nel file Code.gs
 * 4. Deploy > New deployment > Type: Web app
 * 5. Execute as: Me
 * 6. Who has access: Anyone
 * 7. Deploy e copia l'URL
 * 8. Aggiungi URL come APPS_SCRIPT_URL in Cloud Run env vars
 */

// Configurazione AMBARADAM folder
const AMBARADAM_FOLDER_ID = '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb';

/**
 * Entry point per richieste POST
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    console.log('Apps Script request:', data);
    
    switch (data.action) {
      case 'uploadChat':
        return uploadChatToAmbaradam(data);
      case 'uploadNote':
        return uploadNoteToAmbaradam(data);
      case 'uploadBrief':
        return uploadBriefToAmbaradam(data);
      case 'searchFiles':
        return searchFilesInAmbaradam(data);
      case 'listFiles':
        return listFilesInAmbaradam(data);
      default:
        return jsonResponse({ ok: false, error: 'Unknown action: ' + data.action });
    }
  } catch (error) {
    console.error('Apps Script error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'error'
    });
  }
}

/**
 * Upload chat message to AMBARADAM/<USER>/Chat/
 */
function uploadChatToAmbaradam(data) {
  const { chatId, author, text, title } = data;
  
  if (!author || !text) {
    return jsonResponse({ ok: false, error: 'author and text required' });
  }
  
  try {
    // Trova/crea cartella utente
    const userFolder = findOrCreateFolder(AMBARADAM_FOLDER_ID, author.replace(/_/g, ' '));
    const chatFolder = findOrCreateFolder(userFolder.getId(), 'Chat');
    
    // Crea file markdown
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    const time = timestamp.split('T')[1].split('.')[0].replace(/:/g, '');
    const filename = `${date}__${time}__chat.md`;
    
    const titleLine = title ? `# ${title}\n\n` : '';
    const content = 
      `${titleLine}` +
      `**chatId**: ${chatId}\n` +
      `**author**: ${author}\n` +
      `**time**: ${timestamp}\n\n` +
      text + '\n';
    
    const file = chatFolder.createFile(filename, content, 'text/markdown');
    
    return jsonResponse({
      ok: true,
      action: 'uploadChat',
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      fileName: filename
    });
    
  } catch (error) {
    console.error('Upload chat error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'uploadChat'
    });
  }
}

/**
 * Upload note to AMBARADAM/<USER>/Notes/
 */
function uploadNoteToAmbaradam(data) {
  const { owner, text, title } = data;
  
  if (!owner || !text) {
    return jsonResponse({ ok: false, error: 'owner and text required' });
  }
  
  try {
    // Trova/crea cartella utente
    const userFolder = findOrCreateFolder(AMBARADAM_FOLDER_ID, owner.replace(/_/g, ' '));
    const notesFolder = findOrCreateFolder(userFolder.getId(), 'Notes');
    
    // Nome file basato su data
    const date = new Date().toISOString().split('T')[0];
    const filename = `Note-${owner.replace(/_/g, ' ')}-${date}.md`;
    
    const titleLine = title ? `# ${title}\n\n` : '';
    const entry = `${titleLine}${text}\n\n— ${new Date().toISOString()}\n`;
    
    // Cerca file esistente per oggi
    const files = notesFolder.getFilesByName(filename);
    let file;
    
    if (files.hasNext()) {
      // Appendi al file esistente
      file = files.next();
      const currentContent = file.getBlob().getDataAsString();
      const newContent = currentContent + (currentContent.endsWith('\n') ? '' : '\n') + entry;
      file.setContent(newContent);
    } else {
      // Crea nuovo file
      file = notesFolder.createFile(filename, entry, 'text/markdown');
    }
    
    return jsonResponse({
      ok: true,
      action: 'uploadNote',
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      fileName: filename
    });
    
  } catch (error) {
    console.error('Upload note error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'uploadNote'
    });
  }
}

/**
 * Create brief document in AMBARADAM/<USER>/Brief/
 */
function uploadBriefToAmbaradam(data) {
  const { owner, text, title } = data;
  
  if (!owner || !text) {
    return jsonResponse({ ok: false, error: 'owner and text required' });
  }
  
  try {
    // Trova/crea cartella utente
    const userFolder = findOrCreateFolder(AMBARADAM_FOLDER_ID, owner.replace(/_/g, ' '));
    const briefFolder = findOrCreateFolder(userFolder.getId(), 'Brief');
    
    // Nome file basato su data
    const date = new Date().toISOString().split('T')[0];
    const filename = `Brief-${owner.replace(/_/g, ' ')}-${date}.txt`;
    
    const briefTitle = title || `Brief - ${owner} - ${date}`;
    const content = 
      `${briefTitle}\n` +
      `=${'='.repeat(briefTitle.length)}\n\n` +
      text + '\n\n' +
      `Generated: ${new Date().toISOString()}\n`;
    
    const file = briefFolder.createFile(filename, content, 'text/plain');
    
    return jsonResponse({
      ok: true,
      action: 'uploadBrief',
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      fileName: filename
    });
    
  } catch (error) {
    console.error('Upload brief error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'uploadBrief'
    });
  }
}

/**
 * Search files in AMBARADAM
 */
function searchFilesInAmbaradam(data) {
  const { query, limit = 10 } = data;
  
  if (!query) {
    return jsonResponse({ ok: false, error: 'query required' });
  }
  
  try {
    const ambaradam = DriveApp.getFolderById(AMBARADAM_FOLDER_ID);
    const files = [];
    const searchResults = DriveApp.searchFiles(`title contains "${query}" and parents in "${AMBARADAM_FOLDER_ID}"`);
    
    let count = 0;
    while (searchResults.hasNext() && count < limit) {
      const file = searchResults.next();
      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        type: file.getMimeType(),
        size: file.getSize(),
        modified: file.getLastUpdated().toISOString()
      });
      count++;
    }
    
    return jsonResponse({
      ok: true,
      action: 'searchFiles',
      query: query,
      files: files,
      count: files.length
    });
    
  } catch (error) {
    console.error('Search files error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'searchFiles'
    });
  }
}

/**
 * List recent files in AMBARADAM
 */
function listFilesInAmbaradam(data) {
  const { limit = 20 } = data;
  
  try {
    const files = [];
    const allFiles = DriveApp.searchFiles(`parents in "${AMBARADAM_FOLDER_ID}"`);
    
    let count = 0;
    while (allFiles.hasNext() && count < limit) {
      const file = allFiles.next();
      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        type: file.getMimeType(),
        size: file.getSize(),
        modified: file.getLastUpdated().toISOString()
      });
      count++;
    }
    
    // Ordina per data di modifica (più recenti primi)
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    return jsonResponse({
      ok: true,
      action: 'listFiles',
      files: files,
      count: files.length
    });
    
  } catch (error) {
    console.error('List files error:', error);
    return jsonResponse({ 
      ok: false, 
      error: error.toString(),
      action: 'listFiles'
    });
  }
}

/**
 * Helper: trova o crea cartella
 */
function findOrCreateFolder(parentId, folderName) {
  const parent = DriveApp.getFolderById(parentId);
  const folders = parent.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parent.createFolder(folderName);
  }
}

/**
 * Helper: crea risposta JSON
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - chiamabile da script editor
 */
function testAppsScript() {
  console.log('Testing ZANTARA Bridge Apps Script...');
  
  // Test upload chat
  const chatResult = uploadChatToAmbaradam({
    chatId: 'test-123',
    author: 'BOSS',
    text: 'Test chat message from Apps Script',
    title: 'Test Chat'
  });
  
  console.log('Chat upload result:', chatResult.getContent());
  
  // Test upload note
  const noteResult = uploadNoteToAmbaradam({
    owner: 'BOSS',
    text: 'Test note content from Apps Script',
    title: 'Test Note'
  });
  
  console.log('Note upload result:', noteResult.getContent());
  
  return 'Test completed - check console for results';
}