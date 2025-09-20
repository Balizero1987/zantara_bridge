# Firestore Persistence Implementation

This document describes the comprehensive Firestore persistence implementation that replaces the previous in-memory storage system for the Zantara Bridge project.

## Overview

The implementation provides:
- **Conversation Management**: Full CRUD operations for conversations and messages
- **Enhanced Memory Storage**: Improved memory system with relationships and metadata
- **TTL Support**: Automatic cleanup of expired data
- **Backup & Restore**: Complete backup and restoration capabilities
- **Performance Optimization**: Indexing strategies and query optimization
- **Migration Tools**: Scripts to migrate from existing storage systems

## Architecture

### Collections Structure

```
firestore/
├── conversations/          # User conversations
├── messages/              # Individual messages within conversations
├── memory/                # Enhanced memory entries
├── sessions/              # User sessions (existing)
├── audit_logs/            # Audit logging (existing)
├── api_keys/              # API key management (existing)
├── rate_limits/           # Rate limiting (existing)
└── backups/               # Conversation backups
```

### Data Models

#### Conversation Document
```typescript
interface ConversationDocument {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  messageCount: number;
  status: 'active' | 'archived' | 'deleted';
  settings?: { model?, temperature?, systemPrompt?, ... };
  metadata?: { totalTokens?, estimatedCost?, ... };
  expiresAt?: Date; // TTL field
  backup?: { lastBackupAt?, backupLocation?, ... };
}
```

#### Message Document
```typescript
interface MessageDocument {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: { tokens?, model?, tools?, ... };
  parentMessageId?: string;
  edited?: boolean;
  editHistory?: Array<{ content, timestamp, reason? }>;
}
```

#### Enhanced Memory Document
```typescript
interface EnhancedMemoryDocument {
  id: string;
  userId: string;
  content: any;
  tags: string[];
  source?: string;
  type: 'conversation' | 'note' | 'file' | 'email' | 'calendar' | 'other';
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  relevanceScore?: number;
  relatedConversations?: string[];
  relatedMemories?: string[];
  expiresAt?: Date; // TTL field
  searchVector?: number[]; // For future vector search
  metadata?: { size?, format?, encoding?, ... };
}
```

## API Endpoints

### Conversation Management

```
POST   /api/chat/conversations              # Create conversation
GET    /api/chat/conversations              # List user conversations
GET    /api/chat/conversations/:id          # Get specific conversation
PUT    /api/chat/conversations/:id          # Update conversation
DELETE /api/chat/conversations/:id          # Archive conversation

POST   /api/chat/conversations/:id/messages # Add message to conversation
GET    /api/chat/conversations/:id/messages # Get conversation messages
PUT    /api/chat/messages/:id               # Update message

POST   /api/chat/conversations/:id/backup   # Create conversation backup
POST   /api/chat/backups/:id/restore        # Restore from backup
GET    /api/chat/health                     # Health check
```

### Enhanced Memory

```
POST   /actions/memory/save                 # Save memory entry
GET    /actions/memory/search               # Search memory entries
POST   /actions/memory/tag                  # Add tags to memory
POST   /actions/memory/relate               # Create memory relationships
GET    /actions/memory/stats                # Get memory statistics
GET    /actions/memory/health               # Health check
```

## Configuration

### Environment Variables

```bash
# Firestore Configuration
GOOGLE_CLOUD_PROJECT=involuted-box-469105-r0
GOOGLE_APPLICATION_CREDENTIALS=~/zantara-team-key.json

# TTL Configuration (in days)
CONVERSATION_TTL_DAYS=90          # Conversations expire after 90 days
MEMORY_TTL_DAYS=365               # Memory expires after 1 year
AUDIT_RETENTION_DAYS=90           # Audit logs kept for 90 days
BACKUP_RETENTION_DAYS=180         # Backups kept for 6 months

# Performance Configuration
FIRESTORE_MAX_BATCH_SIZE=500      # Maximum batch operation size
FIRESTORE_QUERY_LIMIT=100         # Default query result limit
```

## Required Firestore Indexes

The following composite indexes must be created in the Firebase Console:

### Conversations Collection
```
- Fields: [userId, status, lastActivity]      # User conversations with filtering
- Fields: [userId, tags, lastActivity]        # User conversations by tags
- Fields: [userId, expiresAt]                 # TTL cleanup
```

### Messages Collection
```
- Fields: [conversationId, timestamp]         # Conversation messages chronologically
- Fields: [userId, timestamp]                 # User messages across conversations
```

### Memory Collection
```
- Fields: [userId, type, accessedAt]          # User memory by type and recency
- Fields: [userId, tags, createdAt]           # User memory by tags and creation date
- Fields: [userId, expiresAt]                 # TTL cleanup
```

## Usage Examples

### Creating a Conversation

```typescript
import firestoreManager from './src/core/persistence/FirestoreManager';

const conversation = await firestoreManager.createConversation({
  userId: 'user-123',
  title: 'Planning Meeting Discussion',
  tags: ['work', 'meeting'],
  settings: {
    model: 'gpt-4',
    temperature: 0.7,
    systemPrompt: 'You are a helpful assistant for meeting planning.'
  }
});
```

### Adding Messages

```typescript
const message = await firestoreManager.createMessage({
  conversationId: conversation.id,
  userId: 'user-123',
  role: 'user',
  content: 'Can you help me plan the quarterly review meeting?',
  metadata: {
    tokens: 12,
    model: 'gpt-4'
  }
});
```

### Searching Memory

```typescript
const memories = await firestoreManager.searchEnhancedMemory('user-123', {
  query: 'quarterly review',
  tags: ['work'],
  type: 'conversation',
  limit: 20
});
```

### Creating Backups

```typescript
const backup = await firestoreManager.backupConversation(conversation.id);
console.log(`Backup created: ${backup.backupId}`);

// Restore later
const restored = await firestoreManager.restoreConversation(backup.backupId);
console.log(`Restored to conversation: ${restored.conversationId}`);
```

## Migration from Legacy Storage

### Automatic Migration

Run the migration script to automatically detect and migrate existing data:

```bash
npm run firestore:migrate
```

### Manual Migration

For custom data formats, use the migration helper:

```typescript
import { ManualMigrationHelper } from './src/scripts/migrate-to-firestore';

// Migrate conversations
await ManualMigrationHelper.migrateConversationData(legacyConversations);

// Migrate memory entries
await ManualMigrationHelper.migrateMemoryData(legacyMemoryEntries);
```

## Performance Optimization

### Running Optimization Analysis

```bash
npm run firestore:optimize
```

This script will:
- Analyze collection sizes and query performance
- Identify missing indexes
- Recommend optimization strategies
- Perform automatic cleanup tasks
- Generate detailed performance reports

### Manual Cleanup

```bash
npm run cleanup:run
```

### Performance Best Practices

1. **Use Composite Indexes**: Ensure all multi-field queries have appropriate indexes
2. **Limit Query Results**: Always use `.limit()` for large collections
3. **Batch Operations**: Use batch writes for multiple document updates
4. **TTL Management**: Configure appropriate TTL values for different data types
5. **Regular Cleanup**: Run cleanup tasks regularly to remove expired data

## Security Considerations

### Authentication

All API endpoints require authentication. Users can only access their own data:

```typescript
// Example middleware check
if (!userId || conversation.userId !== userId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### Data Privacy

- **Soft Delete**: Conversations are archived, not immediately deleted
- **Audit Logging**: All operations are logged for compliance
- **TTL Enforcement**: Automatic cleanup ensures data doesn't persist indefinitely
- **Backup Security**: Backups include full conversation context for restoration

### Rate Limiting

Built-in rate limiting protects against abuse:
- API endpoints are rate-limited per user
- Firestore operations use batch processing to prevent quota exhaustion

## Monitoring and Maintenance

### Health Checks

```bash
# Check Firestore connectivity
curl http://localhost:8080/api/chat/health

# Check memory service
curl http://localhost:8080/actions/memory/health
```

### Metrics Collection

The system automatically collects:
- Query performance metrics
- Storage usage statistics
- Error rates and types
- TTL effectiveness

### Automated Cleanup

The system runs hourly cleanup jobs that:
- Remove expired sessions
- Archive expired conversations (with backup)
- Clean up old audit logs
- Remove expired memory entries
- Clean up old backups

## Troubleshooting

### Common Issues

1. **Missing Indexes**: Run `npm run firestore:optimize` to identify required indexes
2. **Slow Queries**: Check the optimization report for performance recommendations
3. **Storage Limits**: Use TTL configuration to manage data retention
4. **Migration Errors**: Check `migration-errors.json` for detailed error information

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
npm run dev
```

### Testing

Run the comprehensive test suite:

```bash
npm run test:firestore
```

## Support

For issues related to the Firestore implementation:

1. Check the optimization report: `npm run firestore:optimize`
2. Review migration logs: `migration-errors.json`
3. Examine performance metrics in `firestore-optimization-report.json`
4. Ensure all required environment variables are set
5. Verify Firestore indexes are created in Firebase Console

## Future Enhancements

- **Vector Search**: Integration with Firestore vector search for semantic memory retrieval
- **Real-time Updates**: WebSocket integration for live conversation updates
- **Advanced Analytics**: Detailed usage and performance analytics
- **Data Export**: Comprehensive data export capabilities for compliance
- **Multi-tenant Support**: Enhanced isolation for enterprise deployments