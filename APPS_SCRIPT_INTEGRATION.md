# 🚀 ZANTARA Bridge - Apps Script Integration

**Status:** ✅ **PRODUCTION READY**  
**Endpoint:** `https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app`  
**Last Updated:** September 15, 2025

## 📋 Overview

Integrazione completa tra Google Apps Script e ZANTARA Bridge per salvare automaticamente contenuti su Google Drive nella cartella AMBARADAM.

## ⚡ Quick Start

### 1. Copia il codice Apps Script
Copia il contenuto di `apps-script-final.gs` nel tuo progetto Google Apps Script.

### 2. Test immediato
```javascript
// Esegui questo per testare subito
testZantaraBridge();
```

### 3. Salva una memoria
```javascript
saveMemoryToBridge(
  "Il mio primo test",
  "Questo è il contenuto della mia memoria",
  ["test", "primo-utilizzo"]
);
```

## 🔧 Configurazione

### Parametri principali:
```javascript
const ZANTARA_BASE_URL = "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";
const API_KEY = "7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3";
const DEFAULT_USER = "BOSS";
```

### Endpoint utilizzato:
- **URL:** `POST /actions/drive/upload`
- **Autenticazione:** API Key + X-BZ-USER header
- **Formato:** Base64 encoded content
- **Destinazione:** Google Drive AMBARADAM folder

## 📚 Funzioni Disponibili

### 🎯 Funzioni Principali

#### `saveMemoryToBridge(title, content, tags)`
Salva una memoria su ZANTARA Bridge.
```javascript
var result = saveMemoryToBridge(
  "Titolo della memoria", 
  "Contenuto dettagliato...", 
  ["tag1", "tag2"]
);
```

#### `testZantaraBridge()`
Testa la connessione con ZANTARA Bridge.
```javascript
if (testZantaraBridge()) {
  Logger.log("✅ Connessione OK!");
}
```

### 📊 Integrazione Google Workspace

#### `saveSheetToZantara(sheetName, startRow, endRow)`
Esporta dati da Google Sheets.
```javascript
saveSheetToZantara("Foglio1", 1, 100);
```

#### `saveDocToZantara(docId, customTitle)`
Salva un Google Document.
```javascript
var docId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
saveDocToZantara(docId, "Titolo personalizzato");
```

#### `saveGmailToZantara(threadId)`
Salva un thread Gmail.
```javascript
var threadId = "thread_12345";
saveGmailToZantara(threadId);
```

### 🔄 Funzioni Batch

#### `batchSaveToZantara(memoryArray)`
Salva multiple memorie in una volta.
```javascript
var memories = [
  {title: "Memoria 1", content: "Contenuto 1", tags: ["batch"]},
  {title: "Memoria 2", content: "Contenuto 2", tags: ["batch"]}
];
batchSaveToZantara(memories);
```

#### `dailyZantaraReport()`
Genera un report giornaliero automatico.
```javascript
dailyZantaraReport(); // Per trigger manuali o schedulati
```

## 🎯 Esempi Pratici

### Esempio 1: Salva nota semplice
```javascript
function salvaNota() {
  saveMemoryToBridge(
    "Meeting Notes - " + new Date().toLocaleDateString(),
    "Punti discussi:\n1. Budget Q4\n2. Nuovi progetti\n3. Team expansion",
    ["meeting", "notes", "business"]
  );
}
```

### Esempio 2: Export foglio vendite
```javascript
function exportVendite() {
  saveSheetToZantara("Vendite 2025", 1, 50);
}
```

### Esempio 3: Backup Gmail importante
```javascript
function backupEmailImportante() {
  var threads = GmailApp.search("subject:contratto OR subject:accordo", 0, 5);
  
  threads.forEach(function(thread) {
    saveGmailToZantara(thread.getId());
  });
}
```

## ⏰ Automazione con Trigger

### Setup trigger giornaliero:
1. Vai su **Trigger** nel tuo progetto Apps Script
2. Aggiungi nuovo trigger:
   - Funzione: `dailyZantaraReport`
   - Evento: Basato sul tempo
   - Tipo: Timer giornaliero
   - Ora: 09:00

### Setup trigger per Gmail:
```javascript
function setupGmailTrigger() {
  ScriptApp.newTrigger('processNewEmails')
    .gmail()
    .create();
}

function processNewEmails(e) {
  // Processa nuove email automaticamente
  var threads = GmailApp.getInboxThreads(0, 5);
  // ... logica personalizzata
}
```

## 🔍 Testing e Debug

### Test di connessione:
```javascript
function runTests() {
  Logger.log("🧪 Avvio test suite...");
  
  // Test 1: Connessione
  var connectionOk = testZantaraBridge();
  
  // Test 2: Salvataggio
  if (connectionOk) {
    var result = saveMemoryToBridge("Test", "Contenuto test", ["test"]);
    Logger.log("Test salvataggio: " + (result.success ? "✅" : "❌"));
  }
  
  Logger.log("Test completati!");
}
```

### Logs utili:
```javascript
// Per vedere tutti i log
Logger.log("Messaggio di debug");

// Per vedere i log nel browser:
// 1. Esegui la funzione
// 2. Vai su "Visualizza" > "Log"
```

## 🛠️ Risoluzione Problemi

### Errori Comuni:

**Errore: "X-API-KEY required"**
- ✅ Verifica che `API_KEY` sia configurato correttamente
- ✅ Controlla che l'header sia incluso nella richiesta

**Errore: "Service account quota"**
- ✅ L'endpoint è configurato per usare OAuth delegation
- ✅ Usa `/actions/drive/upload` (non `/actions/memory/save`)

**File non salvato:**
- ✅ Controlla il log per errori specifici
- ✅ Verifica la connessione con `testZantaraBridge()`
- ✅ Controlla che la cartella AMBARADAM esista

## 📊 Formato Output

Ogni memoria salvata viene formattata così:
```markdown
# Titolo della Memoria

**Data:** 15/09/2025, 21:45:30
**Fonte:** Google Apps Script
**Utente:** BOSS
**Tags:** tag1, tag2

---

Contenuto della memoria...

---
*Salvato automaticamente tramite ZANTARA Bridge Apps Script Integration*
```

## 🌟 Features Avanzate

### 1. **Salvataggio Condizionale**
```javascript
function salvaSoloSeImportante(title, content, tags) {
  var importantKeywords = ["urgent", "importante", "contratto"];
  var isImportant = importantKeywords.some(word => 
    content.toLowerCase().includes(word) || 
    title.toLowerCase().includes(word)
  );
  
  if (isImportant) {
    return saveMemoryToBridge(title, content, tags.concat(["importante"]));
  }
  
  Logger.log("Contenuto non importante, salvataggio saltato");
  return null;
}
```

### 2. **Integrazione Calendar**
```javascript
function saveCalendarEvents() {
  var calendar = CalendarApp.getDefaultCalendar();
  var today = new Date();
  var tomorrow = new Date(today.getTime() + 24*60*60*1000);
  
  var events = calendar.getEvents(today, tomorrow);
  
  var content = "## Eventi di Domani\n\n";
  events.forEach(function(event) {
    content += "- " + event.getTitle() + " (" + event.getStartTime().toLocaleTimeString() + ")\n";
  });
  
  saveMemoryToBridge("Agenda Domani", content, ["calendar", "agenda"]);
}
```

## 📈 Monitoraggio e Metriche

Per monitorare l'uso dell'integrazione:
1. Ogni salvataggio viene loggato con timestamp
2. I file vengono salvati in AMBARADAM/BOSS/
3. Controlla i log di Google Apps Script per statistiche

## 🎉 Risultato

✅ **INTEGRAZIONE APPS SCRIPT COMPLETATA E TESTATA!**

- **Endpoint:** Funzionante al 100%
- **Salvataggio:** Verificato su Google Drive  
- **API:** Autenticazione OK
- **Documentazione:** Completa
- **Esempi:** Pronti all'uso

**L'integrazione è pronta per l'uso in produzione!** 🚀

---

*Creato per ZANTARA Bridge - Indonesian Compliance AI System*  
*Data: 15 Settembre 2025*