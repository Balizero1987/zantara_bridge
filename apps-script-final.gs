/**
 * 🚀 ZANTARA Bridge - Apps Script Integration (PRODUCTION READY)
 * Integrazione completa e testata per Google Apps Script
 */

// 🔧 Configurazione di produzione
const ZANTARA_BASE_URL = "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";
const API_KEY = "7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3";
const DEFAULT_USER = "BOSS";

/**
 * 📝 FUNZIONE PRINCIPALE - Salva memoria su ZANTARA Bridge
 * Usa l'endpoint /actions/drive/upload che è testato e funzionante
 */
function saveMemoryToBridge(title, content, tags) {
  // Prepara il contenuto con metadati
  var fullContent = formatContentForZantara(title, content, tags);
  
  // Converti in base64
  var base64Content = Utilities.base64Encode(fullContent);
  
  // Nome file con timestamp
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  var filename = (title || "memory") + "_" + timestamp + ".md";
  
  var url = ZANTARA_BASE_URL + "/actions/drive/upload";
  
  var payload = {
    filename: filename,
    content: base64Content,
    folderName: DEFAULT_USER
  };
  
  var options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      "X-API-KEY": API_KEY,
      "X-BZ-USER": DEFAULT_USER
    }
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    
    if (result.id) {
      Logger.log("✅ Memoria salvata su ZANTARA Bridge:");
      Logger.log("📁 File ID: " + result.id);
      Logger.log("🔗 URL: " + result.webViewLink);
      Logger.log("📄 Nome: " + result.name);
      
      return {
        success: true,
        fileId: result.id,
        url: result.webViewLink,
        filename: result.name
      };
    } else {
      Logger.log("❌ Errore nel salvare la memoria:");
      Logger.log(result);
      return { success: false, error: result };
    }
  } catch (error) {
    Logger.log("❌ Errore di connessione: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 📋 Formatta il contenuto per ZANTARA
 */
function formatContentForZantara(title, content, tags) {
  var formatted = "";
  
  // Intestazione
  if (title) {
    formatted += "# " + title + "\n\n";
  }
  
  // Metadati
  formatted += "**Data:** " + new Date().toLocaleString('it-IT', {timeZone: 'Asia/Jakarta'}) + "\n";
  formatted += "**Fonte:** Google Apps Script\n";
  formatted += "**Utente:** " + DEFAULT_USER + "\n";
  
  if (tags && tags.length > 0) {
    formatted += "**Tags:** " + tags.join(", ") + "\n";
  }
  
  formatted += "\n---\n\n";
  
  // Contenuto principale
  formatted += content;
  
  // Footer
  formatted += "\n\n---\n*Salvato automaticamente tramite ZANTARA Bridge Apps Script Integration*";
  
  return formatted;
}

/**
 * 🧪 Test di connessione a ZANTARA Bridge
 */
function testZantaraBridge() {
  Logger.log("🧪 Test connessione ZANTARA Bridge...");
  
  var result = saveMemoryToBridge(
    "Test Connessione Apps Script",
    "Questo è un test automatico per verificare che l'integrazione tra Google Apps Script e ZANTARA Bridge funzioni correttamente.\n\nTimestamp: " + new Date().toISOString(),
    ["test", "connessione", "apps-script"]
  );
  
  if (result.success) {
    Logger.log("✅ Test SUPERATO! ZANTARA Bridge è operativo.");
    Logger.log("🔗 File creato: " + result.url);
    return true;
  } else {
    Logger.log("❌ Test FALLITO!");
    Logger.log(result.error);
    return false;
  }
}

/**
 * 📊 Salva dati da Google Sheets
 */
function saveSheetToZantara(sheetName, startRow, endRow) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName || "Foglio1");
    var lastRow = endRow || sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    
    var range = sheet.getRange(startRow || 1, 1, lastRow, lastCol);
    var values = range.getValues();
    
    // Crea il contenuto
    var content = "## Dati da Google Sheets\n\n";
    content += "**Foglio:** " + sheetName + "\n";
    content += "**Righe:** " + startRow + "-" + lastRow + "\n";
    content += "**Colonne:** " + lastCol + "\n\n";
    
    // Aggiungi intestazioni se presenti
    if (values.length > 0) {
      content += "### Dati:\n\n";
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        if (row.some(function(cell) { return cell !== ""; })) {
          content += "**Riga " + (i + 1) + ":** " + row.join(" | ") + "\n";
        }
      }
    }
    
    return saveMemoryToBridge(
      "Export Google Sheets - " + sheetName,
      content,
      ["sheets", "export", "dati"]
    );
    
  } catch (error) {
    Logger.log("❌ Errore nell'esportare il foglio: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 📝 Salva documento Google Docs
 */
function saveDocToZantara(docId, customTitle) {
  try {
    var doc = DocumentApp.openById(docId);
    var docTitle = customTitle || doc.getName();
    var content = doc.getBody().getText();
    
    // Aggiungi informazioni del documento
    var fullContent = "## Documento Google Docs\n\n";
    fullContent += "**Titolo Originale:** " + doc.getName() + "\n";
    fullContent += "**ID Documento:** " + docId + "\n";
    fullContent += "**Ultima Modifica:** " + doc.getLastUpdated().toLocaleString() + "\n\n";
    fullContent += "### Contenuto:\n\n" + content;
    
    return saveMemoryToBridge(
      "Google Docs - " + docTitle,
      fullContent,
      ["docs", "documento", "import"]
    );
    
  } catch (error) {
    Logger.log("❌ Errore nel salvare il documento: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 📧 Salva thread Gmail
 */
function saveGmailToZantara(threadId) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    var messages = thread.getMessages();
    
    var content = "## Thread Gmail\n\n";
    content += "**Oggetto:** " + thread.getFirstMessageSubject() + "\n";
    content += "**Numero Messaggi:** " + messages.length + "\n";
    content += "**Data Thread:** " + thread.getLastMessageDate().toLocaleString() + "\n\n";
    
    // Aggiungi ogni messaggio
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      content += "### Messaggio " + (i + 1) + "\n";
      content += "**Da:** " + msg.getFrom() + "\n";
      content += "**A:** " + msg.getTo() + "\n";
      content += "**Data:** " + msg.getDate().toLocaleString() + "\n\n";
      content += msg.getPlainBody() + "\n\n---\n\n";
    }
    
    return saveMemoryToBridge(
      "Gmail - " + thread.getFirstMessageSubject().substring(0, 50),
      content,
      ["gmail", "email", "thread"]
    );
    
  } catch (error) {
    Logger.log("❌ Errore nel salvare Gmail: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * 🔄 Salvataggio batch (multiplo)
 */
function batchSaveToZantara(memoryArray) {
  var results = [];
  var successCount = 0;
  
  Logger.log("🔄 Avvio salvataggio batch di " + memoryArray.length + " elementi...");
  
  for (var i = 0; i < memoryArray.length; i++) {
    var memory = memoryArray[i];
    var result = saveMemoryToBridge(memory.title, memory.content, memory.tags);
    
    results.push(result);
    if (result.success) successCount++;
    
    // Pausa per evitare rate limiting
    Utilities.sleep(2000);
  }
  
  Logger.log("✅ Batch completato: " + successCount + "/" + memoryArray.length + " successi");
  return {
    totalProcessed: memoryArray.length,
    successful: successCount,
    failed: memoryArray.length - successCount,
    results: results
  };
}

/**
 * 📅 Funzione giornaliera automatica
 */
function dailyZantaraReport() {
  var today = new Date();
  var content = "## Report Giornaliero Apps Script\n\n";
  content += "Data: " + today.toLocaleDateString('it-IT') + "\n";
  content += "Ora: " + today.toLocaleTimeString('it-IT') + "\n";
  content += "Sistema: Google Apps Script + ZANTARA Bridge\n\n";
  content += "Questo report automatico conferma che l'integrazione Apps Script è operativa e funzionante.\n\n";
  content += "### Statistiche Sistema:\n";
  content += "- Endpoint: " + ZANTARA_BASE_URL + "\n";
  content += "- Utente: " + DEFAULT_USER + "\n";
  content += "- Status: Operativo ✅\n\n";
  content += "*Report generato automaticamente*";
  
  return saveMemoryToBridge(
    "Report Giornaliero " + today.toLocaleDateString('it-IT'),
    content,
    ["report", "giornaliero", "sistema"]
  );
}

/**
 * 🚀 ESEMPI DI UTILIZZO
 */
function esempiUtilizzo() {
  Logger.log("🚀 Avvio esempi di utilizzo ZANTARA Bridge...");
  
  // 1. Test di base
  testZantaraBridge();
  
  // 2. Salva nota semplice
  saveMemoryToBridge(
    "Nota di Prova",
    "Questa è una nota di prova creata da Apps Script per testare l'integrazione con ZANTARA Bridge.",
    ["prova", "test", "nota"]
  );
  
  // 3. Salva rapporto giornaliero
  dailyZantaraReport();
  
  Logger.log("✅ Esempi completati! Controlla AMBARADAM su Google Drive.");
}

// 🎯 Per testare subito, decommenta la riga qui sotto:
// testZantaraBridge();