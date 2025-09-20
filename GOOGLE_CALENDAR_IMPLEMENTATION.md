# 📅 Google Calendar Integration - Complete Implementation

## Overview

This document provides a comprehensive overview of the Google Calendar integration implemented for the Zantara Bridge project. The implementation includes advanced features for automatic event creation, natural language processing, conflict detection, and comprehensive event management.

## 🏗️ Architecture

### Core Components

1. **CalendarService** (`src/services/CalendarService.ts`)
   - Main service class handling all calendar operations
   - Google Calendar API client management
   - Event CRUD operations with validation
   - Conflict detection and resolution
   - Timezone handling and conversions

2. **EventParser** (`src/lib/calendar/EventParser.ts`)
   - Natural language processing for event creation
   - Intelligent date/time parsing
   - Attendee extraction from text
   - Location and meeting type detection

3. **NotificationService** (`src/services/NotificationService.ts`)
   - Event notifications (email, push, webhook)
   - Customizable notification templates
   - Audit trail and logging

4. **API Endpoints** (`src/api/calendar.ts`)
   - RESTful API for calendar operations
   - Backward compatibility with existing routes
   - Comprehensive error handling

## 🚀 Features Implemented

### ✅ Core Calendar Operations
- **Create Events**: Full event creation with all Google Calendar features
- **List Events**: Advanced filtering and pagination
- **Get Event**: Retrieve specific event details
- **Update Events**: Partial and full event updates
- **Delete Events**: Safe event deletion with notifications

### ✅ Advanced Features
- **Natural Language Parsing**: "Schedule team meeting tomorrow at 2pm with john@example.com"
- **Conflict Detection**: Automatic detection of scheduling conflicts
- **Timezone Management**: Proper timezone handling for global teams
- **Recurring Events**: Support for daily, weekly, monthly patterns
- **Google Meet Integration**: Automatic video conference links
- **Attendee Management**: Email invitations and responses

### ✅ Integrations
- **Firestore Persistence**: Event audit trail and backup
- **Notification System**: Multi-channel notifications
- **Authentication**: Service account with domain-wide delegation
- **Error Handling**: Comprehensive error management and logging

## 📋 API Endpoints

### Core Operations

#### Create Event
```bash
POST /actions/calendar/create
Content-Type: application/json
Authorization: Bearer {token}

{
  "summary": "Team Meeting",
  "description": "Weekly sync meeting",
  "location": "Conference Room A",
  "start": {
    "dateTime": "2025-01-20T10:00:00+07:00",
    "timeZone": "Asia/Jakarta"
  },
  "end": {
    "dateTime": "2025-01-20T11:00:00+07:00",
    "timeZone": "Asia/Jakarta"
  },
  "attendees": [
    {
      "email": "john@example.com",
      "displayName": "John Doe"
    }
  ],
  "conferenceData": {
    "createRequest": {
      "requestId": "meet_12345",
      "conferenceSolutionKey": {
        "type": "hangoutsMeet"
      }
    }
  }
}
```

#### List Events
```bash
GET /actions/calendar/list
Authorization: Bearer {token}

Query Parameters:
- maxResults: Number of events to return (default: 50, max: 250)
- timeMin: Start time filter (ISO 8601)
- timeMax: End time filter (ISO 8601)
- timeZone: Timezone for the query
- includeDeleted: Include deleted events (default: false)
```

#### Get Event
```bash
GET /actions/calendar/events/{eventId}
Authorization: Bearer {token}
```

#### Update Event
```bash
PUT /actions/calendar/update/{eventId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "summary": "Updated Meeting Title",
  "start": {
    "dateTime": "2025-01-20T14:00:00+07:00"
  }
}
```

#### Delete Event
```bash
DELETE /actions/calendar/delete/{eventId}
Authorization: Bearer {token}
```

### Advanced Features

#### Parse Natural Language
```bash
POST /actions/calendar/parse
Content-Type: application/json
Authorization: Bearer {token}

{
  "text": "Schedule team standup tomorrow at 9am with dev-team@example.com",
  "createEvent": true,
  "timeZone": "Asia/Jakarta"
}
```

#### Check Conflicts
```bash
POST /actions/calendar/conflicts
Content-Type: application/json
Authorization: Bearer {token}

{
  "summary": "New Meeting",
  "start": {
    "dateTime": "2025-01-20T10:00:00+07:00"
  },
  "end": {
    "dateTime": "2025-01-20T11:00:00+07:00"
  }
}
```

## 🔧 Configuration

### Environment Variables

```env
# Google Calendar Configuration
BALI_ZERO_CALENDAR_ID=c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com
CALENDAR_DEFAULT_TIMEZONE=Asia/Jakarta
ENABLE_CALENDAR_SYNC=true

# Google Authentication
GOOGLE_APPLICATION_CREDENTIALS=~/zantara-team-key.json
GOOGLE_CLOUD_PROJECT=involuted-box-469105-r0
IMPERSONATE_USER=your-domain-user@yourdomain.com

# Notification Configuration
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_PUSH_NOTIFICATIONS=false
ENABLE_WEBHOOK_NOTIFICATIONS=false
DEFAULT_WEBHOOK_URL=https://your-webhook-endpoint.com/calendar
```

### Service Account Setup

1. **Create Service Account**
   ```bash
   gcloud iam service-accounts create zantara-calendar \
     --display-name="Zantara Calendar Service"
   ```

2. **Grant Calendar Permissions**
   ```bash
   gcloud projects add-iam-policy-binding involuted-box-469105-r0 \
     --member="serviceAccount:zantara-calendar@involuted-box-469105-r0.iam.gserviceaccount.com" \
     --role="roles/calendar.editor"
   ```

3. **Enable Domain-Wide Delegation**
   - Go to Google Admin Console
   - Security → API Controls → Domain-wide delegation
   - Add client ID with scopes:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`

4. **Share Calendar**
   - Share the calendar with the service account email
   - Grant "Make changes to events" permission

## 🧪 Testing

### Unit Tests
```bash
npm test -- --testPathPattern=calendar-service
```

### API Tests
```bash
npm test -- --testPathPattern=calendar-api
```

### Integration Tests
```bash
npm test -- --testPathPattern=calendar --verbose
```

### Manual Testing
```bash
# Validate implementation
node validate-calendar.js

# Test API endpoints
curl -X POST http://localhost:8080/actions/calendar/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Test Event",
    "start": {"dateTime": "2025-01-20T10:00:00+07:00"},
    "end": {"dateTime": "2025-01-20T11:00:00+07:00"}
  }'
```

## 📊 Event Parsing Examples

The natural language parser can handle various formats:

### Basic Scheduling
```
"Schedule team meeting tomorrow at 2pm"
→ Creates: Team meeting on [tomorrow] 14:00-15:00
```

### With Attendees
```
"Weekly standup with john@example.com and jane@example.com every Monday at 9am"
→ Creates: Recurring weekly meeting with attendees
```

### With Location
```
"Client presentation in conference room A on Friday at 3pm for 2 hours"
→ Creates: 2-hour meeting with location
```

### Video Meetings
```
"Zoom call with the development team tomorrow at 10am"
→ Creates: Meeting with Google Meet integration
```

### Recurring Events
```
"Daily standup every weekday at 9am"
→ Creates: Recurring Mon-Fri meeting
```

## 🔒 Security & Permissions

### Authentication Flow
1. Service account authenticates with Google APIs
2. Domain-wide delegation enables user impersonation
3. API requests validated with JWT tokens
4. Calendar permissions checked per operation

### Data Protection
- Event data encrypted in transit and at rest
- Firestore audit trails for compliance
- Rate limiting to prevent abuse
- Input validation and sanitization

## 📈 Performance Optimizations

### Caching Strategy
- Calendar events cached for 5 minutes
- Conflict detection results cached per user
- Free/busy information cached for 15 minutes

### Batch Operations
- Bulk event creation/updates
- Efficient conflict checking
- Optimized Firestore writes

### Error Handling
- Graceful degradation on API failures
- Retry logic for transient errors
- Comprehensive error logging

## 🔄 Migration & Backward Compatibility

### Legacy Support
- Existing calendar routes maintained
- Field mapping for `title` → `summary`
- Compatible response formats

### Data Migration
```javascript
// Migrate existing events to new format
const migrationScript = require('./src/scripts/migrate-calendar-events');
await migrationScript.run();
```

## 🚀 Deployment

### Build & Deploy
```bash
# Build TypeScript
npm run build

# Start server
npm start

# Deploy to Google Cloud Run
./deploy-cloudrun.sh
```

### Health Checks
```bash
# Check calendar service health
curl http://localhost:8080/health

# Validate calendar configuration
curl http://localhost:8080/actions/calendar/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📞 Support & Troubleshooting

### Common Issues

#### "Calendar not found"
- Verify `BALI_ZERO_CALENDAR_ID` is correct
- Check service account has calendar access
- Ensure calendar is shared with service account

#### "Permission denied"
- Verify domain-wide delegation is configured
- Check `IMPERSONATE_USER` has calendar permissions
- Validate service account key file

#### "Invalid timezone"
- Use IANA timezone names (e.g., `Asia/Jakarta`)
- Include timezone in dateTime objects
- Check `CALENDAR_DEFAULT_TIMEZONE` setting

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm start
```

### Performance Monitoring
```bash
# Check metrics endpoint
curl http://localhost:8080/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔮 Future Enhancements

### Planned Features
- [ ] Calendar analytics and insights
- [ ] Smart meeting scheduling suggestions
- [ ] Integration with external calendar systems
- [ ] Advanced recurring pattern support
- [ ] Voice-to-calendar integration
- [ ] AI-powered meeting optimization

### API Versioning
- Current version: v1
- Planned v2 with GraphQL support
- Backward compatibility maintained

## 📄 License & Credits

This implementation is part of the Zantara Bridge project and follows the same licensing terms. Built with:

- Google Calendar API v3
- Google Cloud Firestore
- Express.js
- TypeScript
- Jest for testing

---

**Last Updated**: January 20, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

For support, please contact the Zantara development team or create an issue in the project repository.