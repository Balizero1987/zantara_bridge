# 📅 ZANTARA CALENDAR INTEGRATION

## ✅ NEW CALENDAR ID (19 Gennaio 2025)

```
Calendar ID: c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com
Source: Claude 4
Status: READY FOR INTEGRATION
```

## 🔧 CONFIGURAZIONE

### 1. Environment Variables (.env)
```env
# Calendar Configuration
BALI_ZERO_CALENDAR_ID=c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com
CALENDAR_DEFAULT_TIMEZONE=Asia/Jakarta
ENABLE_CALENDAR_SYNC=true
```

### 2. Service Account Permissions
Il service account deve avere i seguenti permessi sul calendar:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

### 3. Condividere il Calendar
1. Vai su Google Calendar
2. Settings → Share with specific people
3. Aggiungi il service account email con permesso "Make changes to events"

## 📍 API ENDPOINTS

### Create Event
```bash
POST /actions/calendar/create
Authorization: Bearer {token}

{
  "summary": "Team Meeting",
  "description": "Weekly sync",
  "start": "2025-01-20T10:00:00+07:00",
  "end": "2025-01-20T11:00:00+07:00",
  "attendees": ["team@balizero.com"],
  "location": "Bali Office"
}
```

### List Events
```bash
GET /actions/calendar/list?maxResults=10
Authorization: Bearer {token}
```

### Update Event
```bash
PUT /actions/calendar/update/{eventId}
Authorization: Bearer {token}

{
  "summary": "Updated Meeting Title",
  "start": "2025-01-20T14:00:00+07:00"
}
```

### Delete Event
```bash
DELETE /actions/calendar/delete/{eventId}
Authorization: Bearer {token}
```

## 🧪 TEST CALENDAR

```javascript
// Test script
const { google } = require('googleapis');

async function testCalendar() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account.json',
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  const calendar = google.calendar({ version: 'v3', auth });
  
  // Test listing events
  const response = await calendar.events.list({
    calendarId: 'c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com',
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  });

  console.log('Events:', response.data.items);
}

testCalendar().catch(console.error);
```

## 🔐 AUTHENTICATION

Il calendar richiede autenticazione. Opzioni disponibili:

1. **JWT Token** (Raccomandato)
```javascript
headers: {
  'Authorization': 'Bearer ' + jwtToken
}
```

2. **API Key** 
```javascript
headers: {
  'X-API-Key': 'sk-project-...'
}
```

3. **Legacy AMBARADAM** (Backward compatibility)
```javascript
// Login prima
POST /identity/login
{
  "name": "User",
  "magicWord": "BaliZero2025"
}
```

## 🚀 QUICK START

1. **Setup .env**
```bash
echo "BALI_ZERO_CALENDAR_ID=c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com" >> .env
```

2. **Test Connection**
```bash
curl -X GET https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/actions/calendar/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Create First Event**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/actions/calendar/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Zantara Calendar Test",
    "start": "2025-01-20T10:00:00+07:00",
    "end": "2025-01-20T11:00:00+07:00"
  }'
```

## 🐛 TROUBLESHOOTING

### "Calendar not found"
- Verifica che il Calendar ID sia corretto
- Controlla che il service account abbia accesso

### "Insufficient permissions"
- Il service account deve avere ruolo "Editor" sul calendar
- Verifica gli scope nella configurazione

### "Invalid time zone"
- Usa formato ISO 8601 con timezone: `2025-01-20T10:00:00+07:00`
- Default timezone: Asia/Jakarta (UTC+7)

## 📝 NOTES

- Il Calendar ID è stato fornito da Claude 4 il 19 Gennaio 2025
- Il sistema supporta sia eventi singoli che ricorrenti
- Rate limit: 100 requests per minute per user
- Cache events per 5 minuti per performance

## 🔄 MIGRATION

Se stai migrando da un vecchio calendar:

1. Export eventi dal vecchio calendar
2. Update BALI_ZERO_CALENDAR_ID in .env
3. Import eventi nel nuovo calendar
4. Test con `/actions/calendar/list`

---

**Last Updated:** 19 Gennaio 2025
**Calendar Status:** ✅ READY
**Integration Level:** FULL