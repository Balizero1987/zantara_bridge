# 🔗 ESEMPI INTEGRAZIONE ZANTARA BRIDGE

## 🤖 CHATGPT/CLAUDE INTEGRATION

### Custom GPT Configuration
```yaml
name: Zantara Assistant
description: Interfaccia con Zantara Bridge per gestione documenti e calendario
api:
  type: actions
  url: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
  auth:
    type: api_key
    header: X-API-Key
    value: ${ZANTARA_API_KEY}
```

### Claude Tool Use
```javascript
{
  "name": "zantara_drive_upload",
  "description": "Upload file to Google Drive via Zantara",
  "parameters": {
    "type": "object",
    "properties": {
      "filename": { "type": "string" },
      "content": { "type": "string" },
      "folderId": { "type": "string" }
    }
  },
  "api_call": {
    "method": "POST",
    "endpoint": "/drive/upload",
    "headers": {
      "X-API-Key": "${API_KEY}"
    }
  }
}
```

---

## 🔄 ZAPIER/MAKE INTEGRATION

### Zapier Webhook
```javascript
// Trigger: New File in Drive
const zapierWebhook = {
  url: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    source: 'zantara',
    event: 'file_uploaded',
    data: {
      fileId: '{{fileId}}',
      fileName: '{{fileName}}',
      timestamp: new Date().toISOString()
    }
  }
};
```

### Make.com Scenario
```json
{
  "name": "Sync Zantara Calendar",
  "trigger": {
    "type": "webhook",
    "url": "https://hook.eu1.make.com/unique-webhook-url"
  },
  "modules": [
    {
      "name": "Get Zantara Events",
      "type": "http",
      "method": "GET",
      "url": "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/calendar/list",
      "headers": {
        "X-API-Key": "{{API_KEY}}"
      }
    }
  ]
}
```

---

## 📱 MOBILE APP INTEGRATION

### React Native
```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ZantaraClient {
  constructor() {
    this.baseURL = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';
    this.apiKey = null;
  }

  async init() {
    this.apiKey = await AsyncStorage.getItem('zantara_api_key');
  }

  async uploadFile(name, content, folderId) {
    const response = await axios.post(
      `${this.baseURL}/drive/upload`,
      {
        name,
        content: Buffer.from(content).toString('base64'),
        folderId
      },
      {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  async createEvent(eventData) {
    const response = await axios.post(
      `${this.baseURL}/calendar/create`,
      eventData,
      {
        headers: {
          'X-API-Key': this.apiKey
        }
      }
    );
    return response.data;
  }
}

export default new ZantaraClient();
```

### Flutter
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ZantaraService {
  final String baseUrl = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';
  final String apiKey;

  ZantaraService({required this.apiKey});

  Future<Map<String, dynamic>> uploadFile(
    String fileName,
    List<int> content,
    String folderId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/drive/upload'),
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'name': fileName,
        'content': base64Encode(content),
        'folderId': folderId,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to upload file');
    }
  }
}
```

---

## 🌐 WEB INTEGRATION

### Vanilla JavaScript
```html
<!DOCTYPE html>
<html>
<head>
  <title>Zantara Integration</title>
</head>
<body>
  <input type="file" id="fileInput">
  <button onclick="uploadFile()">Upload to Drive</button>

  <script>
    const ZANTARA_API = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';
    const API_KEY = 'your-api-key'; // In produzione, usa env vars

    async function uploadFile() {
      const fileInput = document.getElementById('fileInput');
      const file = fileInput.files[0];
      
      if (!file) {
        alert('Seleziona un file');
        return;
      }

      const reader = new FileReader();
      reader.onload = async function(e) {
        const base64 = btoa(e.target.result);
        
        try {
          const response = await fetch(`${ZANTARA_API}/drive/upload`, {
            method: 'POST',
            headers: {
              'X-API-Key': API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: file.name,
              content: base64,
              folderId: '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb'
            })
          });
          
          const data = await response.json();
          if (data.ok) {
            alert('File caricato con successo!');
          } else {
            alert('Errore: ' + data.error);
          }
        } catch (error) {
          alert('Errore di rete: ' + error);
        }
      };
      
      reader.readAsBinaryString(file);
    }
  </script>
</body>
</html>
```

### React
```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ZantaraUploader = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const response = await axios.post(
          'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/drive/upload',
          {
            name: file.name,
            content: btoa(e.target.result),
            folderId: '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb'
          },
          {
            headers: {
              'X-API-Key': process.env.REACT_APP_ZANTARA_API_KEY
            }
          }
        );
        
        if (response.data.ok) {
          alert('Upload successful!');
        }
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setUploading(false);
      }
    };
    
    reader.readAsBinaryString(file);
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files[0])}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload to Drive'}
      </button>
    </div>
  );
};

export default ZantaraUploader;
```

---

## 🔧 BACKEND INTEGRATION

### Node.js Express Middleware
```javascript
const express = require('express');
const axios = require('axios');

class ZantaraMiddleware {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';
  }

  // Middleware per proxy delle richieste
  proxy() {
    return async (req, res, next) => {
      try {
        const response = await axios({
          method: req.method,
          url: `${this.baseURL}${req.path}`,
          data: req.body,
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        res.json(response.data);
      } catch (error) {
        res.status(error.response?.status || 500).json({
          ok: false,
          error: error.message
        });
      }
    };
  }

  // Rate limit handler
  handleRateLimit() {
    return (req, res, next) => {
      if (res.getHeader('X-RateLimit-Remaining') === '0') {
        const retryAfter = res.getHeader('X-RateLimit-Reset');
        res.status(429).json({
          ok: false,
          error: 'Rate limit exceeded',
          retryAfter
        });
      } else {
        next();
      }
    };
  }
}

// Uso
const app = express();
const zantara = new ZantaraMiddleware(process.env.ZANTARA_API_KEY);

app.use('/api/zantara', zantara.proxy());
app.use(zantara.handleRateLimit());
```

### Python Django
```python
# zantara_client.py
import requests
import base64
from django.conf import settings
from django.core.cache import cache
import time

class ZantaraClient:
    def __init__(self):
        self.base_url = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'
        self.api_key = settings.ZANTARA_API_KEY
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        })

    def _handle_rate_limit(self, response):
        """Gestisce rate limiting con retry automatico"""
        if response.status_code == 429:
            retry_after = response.headers.get('X-RateLimit-Reset')
            if retry_after:
                sleep_time = int(retry_after) - int(time.time())
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    return True
        return False

    def upload_file(self, file_path, folder_id):
        """Upload file con retry su rate limit"""
        with open(file_path, 'rb') as f:
            content = base64.b64encode(f.read()).decode('utf-8')
        
        data = {
            'name': os.path.basename(file_path),
            'content': content,
            'folderId': folder_id
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            response = self.session.post(
                f'{self.base_url}/drive/upload',
                json=data
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                if not self._handle_rate_limit(response):
                    break
            else:
                response.raise_for_status()
        
        raise Exception('Max retries exceeded')

# views.py
from django.http import JsonResponse
from .zantara_client import ZantaraClient

def upload_to_drive(request):
    if request.method == 'POST':
        file = request.FILES.get('file')
        if file:
            client = ZantaraClient()
            result = client.upload_file(
                file.temporary_file_path(),
                '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb'
            )
            return JsonResponse(result)
    
    return JsonResponse({'ok': False, 'error': 'Invalid request'})
```

---

## 🧪 TESTING & DEBUGGING

### Postman Collection
```json
{
  "info": {
    "name": "Zantara Bridge API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "apikey",
    "apikey": [
      {
        "key": "key",
        "value": "X-API-Key",
        "type": "string"
      },
      {
        "key": "value",
        "value": "{{api_key}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "Upload File",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/drive/upload",
        "body": {
          "mode": "raw",
          "raw": {
            "name": "test.txt",
            "content": "{{file_base64}}",
            "folderId": "{{folder_id}}"
          }
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"
    },
    {
      "key": "api_key",
      "value": "your-api-key"
    }
  ]
}
```

### cURL Debug Script
```bash
#!/bin/bash

# test_zantara.sh
API_KEY="your-api-key"
BASE_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"

# Colori output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Testing Zantara Bridge API..."

# Test 1: Health Check
echo -n "1. Health Check: "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH" == "200" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ (Status: $HEALTH)${NC}"
fi

# Test 2: Auth Check
echo -n "2. Auth Check: "
AUTH=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/identity/me")
if [ "$AUTH" == "200" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ (Status: $AUTH)${NC}"
fi

# Test 3: Rate Limit Headers
echo "3. Rate Limit Info:"
curl -s -I -H "X-API-Key: $API_KEY" "$BASE_URL/calendar/list" | grep "X-RateLimit"
```

---

**Ultimo aggiornamento**: 2024-01-19
**Versione API**: v3.5.0