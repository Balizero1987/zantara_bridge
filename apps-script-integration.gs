/**
 * ZANTARA Bridge - Apps Script Integration
 */
const ZANTARA_BASE_URL = "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";
const API_KEY = "7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3";
const DEFAULT_USER = "BOSS";

function saveMemoryToBridge(title, content, tags) {
  var url = ZANTARA_BASE_URL + "/saveMemory";
  var payload = {
    title: title,
    content: content,
    tags: tags || []
  };
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      "X-Api-Key": API_KEY,
      "X-BZ-USER": DEFAULT_USER
    },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  return response.getContentText();
}

function testSave() {
  var result = saveMemoryToBridge(
    "TEST – " + DEFAULT_USER + " – 2025-09-15",
    "Contenuto di prova",
    ["#memo"]
  );
  Logger.log(result);
}

/**
 * 🧪 Test ZANTARA Bridge connection
 */
function testZantaraBridge() {
  var testUrl = ZANTARA_BASE_URL + "/saveMemory/test";
  
  var options = {
    method: "GET",
    headers: {
      "X-BZ-USER": DEFAULT_USER
    }
  };
  
  try {
    var response = UrlFetchApp.fetch(testUrl, options);
    var result = JSON.parse(response.getContentText());
    
    Logger.log("🚀 ZANTARA Bridge Test Result:");
    Logger.log(result);
    
    if (result.ok) {
      Logger.log("✅ Connection successful!");
      return true;
    } else {
      Logger.log("❌ Connection failed");
      return false;
    }
  } catch (error) {
    Logger.log("❌ Test failed: " + error.toString());
    return false;
  }
}

/**
 * 📊 Save Google Sheets data to ZANTARA
 */
function saveSheetDataToZantara(sheetName, range) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName || "Sheet1");
    var data = sheet.getRange(range || "A1:Z100").getValues();
    
    // Convert data to readable format
    var content = "# Google Sheets Data Export\n\n";
    content += "**Sheet:** " + sheetName + "\n";
    content += "**Range:** " + range + "\n";
    content += "**Export Date:** " + new Date().toLocaleString() + "\n\n";
    
    // Add table data
    content += "## Data:\n\n";
    for (var i = 0; i < data.length; i++) {
      if (data[i].some(cell => cell !== "")) {
        content += "Row " + (i + 1) + ": " + data[i].join(" | ") + "\n";
      }
    }
    
    return saveMemoryToBridge(
      "Google Sheets Export - " + sheetName,
      content,
      ["sheets", "export", "data"]
    );
  } catch (error) {
    Logger.log("❌ Error saving sheet data: " + error.toString());
    return null;
  }
}

/**
 * 📝 Save Google Docs content to ZANTARA
 */
function saveDocToZantara(docId, title) {
  try {
    var doc = DocumentApp.openById(docId);
    var content = doc.getBody().getText();
    var docTitle = title || doc.getName();
    
    return saveMemoryToBridge(
      "Google Doc - " + docTitle,
      content,
      ["docs", "document", "import"]
    );
  } catch (error) {
    Logger.log("❌ Error saving document: " + error.toString());
    return null;
  }
}

/**
 * 📧 Save Gmail thread to ZANTARA
 */
function saveGmailThreadToZantara(threadId) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    var messages = thread.getMessages();
    
    var content = "# Gmail Thread Export\n\n";
    content += "**Subject:** " + thread.getFirstMessageSubject() + "\n";
    content += "**Messages:** " + messages.length + "\n";
    content += "**Export Date:** " + new Date().toLocaleString() + "\n\n";
    
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      content += "## Message " + (i + 1) + "\n";
      content += "**From:** " + msg.getFrom() + "\n";
      content += "**Date:** " + msg.getDate().toLocaleString() + "\n";
      content += "**Body:**\n" + msg.getPlainBody() + "\n\n---\n\n";
    }
    
    return saveMemoryToBridge(
      "Gmail Thread - " + thread.getFirstMessageSubject().substring(0, 50),
      content,
      ["gmail", "email", "thread"]
    );
  } catch (error) {
    Logger.log("❌ Error saving Gmail thread: " + error.toString());
    return null;
  }
}

/**
 * 🔄 Batch save multiple memories
 */
function batchSaveToZantara(memories) {
  var results = [];
  
  for (var i = 0; i < memories.length; i++) {
    var memory = memories[i];
    var result = saveMemoryToBridge(memory.title, memory.content, memory.tags);
    results.push(result);
    
    // Small delay to avoid rate limiting
    Utilities.sleep(1000);
  }
  
  Logger.log("✅ Batch save completed. Results: " + results.length);
  return results;
}

/**
 * 📋 Example usage functions
 */
function exampleUsage() {
  // Test connection
  testZantaraBridge();
  
  // Save a simple note
  saveMemoryToBridge(
    "Test from Apps Script",
    "This is a test message from Google Apps Script integration.",
    ["test", "apps-script", "integration"]
  );
  
  // Save current date info
  saveMemoryToBridge(
    "Daily Log " + new Date().toDateString(),
    "Automated daily log entry created at " + new Date().toLocaleString(),
    ["daily", "log", "automated"]
  );
}

/**
 * 🕒 Scheduled function - run daily
 */
function dailyZantaraSave() {
  var today = new Date().toDateString();
  var content = "# Daily Apps Script Report\n\n";
  content += "Date: " + today + "\n";
  content += "Time: " + new Date().toLocaleTimeString() + "\n";
  content += "Status: Automated daily save from Google Apps Script\n\n";
  content += "This is an automated entry to confirm the ZANTARA Bridge integration is working correctly.";
  
  saveMemoryToBridge(
    "Daily Report - " + today,
    content,
    ["daily", "automated", "system-check"]
  );
}

// 🚀 Auto-run test on script load (for debugging)
// Uncomment the line below to test automatically
// testZantaraBridge();