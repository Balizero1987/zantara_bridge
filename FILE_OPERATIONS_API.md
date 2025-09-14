# 📁 FILE OPERATIONS API - ZANTARA BRIDGE

## 🚀 NUOVE FUNZIONALITÀ DISPONIBILI

### 1️⃣ **CANCELLAZIONE FILE**
```bash
DELETE /api/files/{fileId}
```

**Esempio:**
```bash
curl -X DELETE https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/ABC123 \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "fileId": "ABC123"
}
```

---

### 2️⃣ **SINTESI DOCUMENTI**
```bash
POST /api/files/summarize
```

**Con File ID da Drive:**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/summarize \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "ABC123",
    "language": "it"
  }'
```

**Con contenuto Base64:**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/summarize \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{
    "base64Content": "VGVzdCBkb2N1bWVudCBjb250ZW50...",
    "language": "en"
  }'
```

**Response:**
```json
{
  "success": true,
  "summary": "Il documento tratta di...",
  "originalLength": 5000,
  "summaryLength": 500,
  "compressionRatio": "90%",
  "language": "it",
  "tokens": 750
}
```

---

### 3️⃣ **ANALISI COMPLIANCE**
```bash
POST /api/files/analyze
```

**Tipi di analisi disponibili:**
- `compliance` - Verifica compliance Indonesia (KITAS, KITAP, PT PMA)
- `contract` - Analisi contratti e accordi
- `tax` - Implicazioni fiscali Indonesia

**Esempio:**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/analyze \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "ABC123",
    "analysisType": "compliance"
  }'
```

**Response:**
```json
{
  "success": true,
  "analysisType": "compliance",
  "analysis": "⚠️ Il documento presenta le seguenti questioni di compliance:\n1. Manca riferimento al KITAS...\n2. Requisiti PT PMA non soddisfatti...",
  "warnings": true,
  "tokens": 1200
}
```

---

### 4️⃣ **OPERAZIONI BATCH**
```bash
POST /api/files/batch
```

**Cancellazione multipla:**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/batch \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "delete",
    "fileIds": ["ABC123", "DEF456", "GHI789"],
    "userId": "antonello"
  }'
```

**Sintesi multipla:**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/files/batch \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "summarize",
    "fileIds": ["ABC123", "DEF456"],
    "userId": "antonello"
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "fileId": "ABC123", "success": true, "summary": "..." },
    { "fileId": "DEF456", "success": true, "summary": "..." }
  ],
  "errors": [],
  "processed": 2,
  "failed": 0
}
```

---

## 📊 **FUNZIONALITÀ ESISTENTI**

### Lista File
```bash
GET /api/files/{userId}?limit=10
```

### Upload File
```bash
POST /api/upload
{
  "base64Data": "...",
  "fileName": "document.pdf",
  "userId": "antonello",
  "mimeType": "application/pdf"
}
```

### Crea Brief/Riassunto Giornaliero
```bash
POST /api/drive/brief
{
  "dateKey": "2024-09-15",
  "owner": "antonello"
}
```

---

## 🔐 **AUTENTICAZIONE**
Tutti gli endpoint richiedono:
- Header: `X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3`

---

## 🎯 **USI PRATICI**

### 1. **Gestione Documenti KITAS**
```javascript
// Upload documento
const uploadRes = await uploadDocument(kitasFile);

// Analizza per compliance
const analysis = await analyzeFile(uploadRes.fileId, 'compliance');

// Se non compliant, cancella
if (analysis.warnings) {
  await deleteFile(uploadRes.fileId);
}
```

### 2. **Sintesi Contratti Batch**
```javascript
// Ottieni lista contratti
const files = await listFiles('antonello');

// Genera sintesi per tutti
const summaries = await batchOperation('summarize', files.map(f => f.id));
```

### 3. **Analisi Fiscale Documenti**
```javascript
// Analizza documento per implicazioni fiscali
const taxAnalysis = await analyzeFile(docId, 'tax');

// Salva analisi
await saveAnalysis(taxAnalysis);
```

---

## ⚡ **PERFORMANCE**
- Sintesi: 3-5 secondi per documento
- Analisi: 5-8 secondi per documento
- Cancellazione: < 1 secondo
- Batch: Processamento parallelo

---

## 🚨 **LIMITI**
- Max file size per sintesi: 50KB testo
- Max batch operations: 10 file per volta
- Rate limit: 100 richieste/minuto

---

## 📱 **INTEGRAZIONE DASHBOARD**
```javascript
// Dashboard può usare questi endpoint
const fileOps = {
  delete: (id) => fetch(`/api/files/${id}`, { method: 'DELETE' }),
  summarize: (id) => fetch('/api/files/summarize', { 
    method: 'POST', 
    body: JSON.stringify({ fileId: id })
  }),
  analyze: (id, type) => fetch('/api/files/analyze', {
    method: 'POST',
    body: JSON.stringify({ fileId: id, analysisType: type })
  })
};
```

---

## ✅ **SISTEMA COMPLETO**
Il sistema ora supporta:
- ✅ Chat AI con GPT-4
- ✅ Upload documenti
- ✅ **Cancellazione file**
- ✅ **Sintesi documenti**
- ✅ **Analisi compliance**
- ✅ **Operazioni batch**
- ✅ Multi-lingua
- ✅ Cache intelligente

**Pronto per produzione!** 🚀