# Google Drive API Implementation

## Overview

This document describes the real Google Drive API integration implemented for the Zantara Bridge project. The implementation replaces the previous mock implementation with full Google Drive functionality using service account authentication with domain-wide delegation.

## Architecture

### Service Account Configuration
- **Project**: involuted-box-469105-r0
- **Service Account**: zantara-agents@involuted-box-469105-r0.iam.gserviceaccount.com
- **Key File**: ~/zantara-team-key.json
- **Target Folder**: AMBARADAM (ID: 1UGbm5er6Go351S57GQKUjmxMxHyT4QZb)

### Authentication Flow
The implementation uses Google Service Account with domain-wide delegation to impersonate users within the balizero.com domain. This allows the service to access Google Drive files on behalf of authorized users.

## Implementation Details

### Core Files Modified/Created

#### 1. `/src/google.ts` - Authentication Module
- **Replaced**: Mock implementation with real Google Auth
- **Features**:
  - Service account authentication with domain-wide delegation
  - Scoped client creation for Drive, Calendar, and Gmail APIs
  - Environment validation
  - Enhanced error handling

#### 2. `/src/lib/driveHelpers.ts` - Drive Helper Functions
- **New**: Comprehensive helper functions for Drive operations
- **Features**:
  - Enhanced file upload with validation
  - Smart file search with proper error handling
  - File content retrieval with support for Google Workspace files
  - Health check functionality
  - Standardized error handling and logging

#### 3. Drive Action Handlers (Updated)
- **Files**: `/src/actions/drive/*.ts`
- **Updated**: search.ts, upload.ts, content.ts
- **Features**:
  - Environment validation before operations
  - Enhanced error handling with specific error codes
  - Comprehensive logging for debugging
  - Real Google Drive API integration

#### 4. `/src/api/drive.ts` - Router Configuration
- **Updated**: Enabled all drive endpoints
- **Added**: Health check endpoint at `/health/drive`

#### 5. Production Setup Scripts
- **Created**: `setup-drive-production.sh` - Production deployment setup
- **Created**: `validate-drive-config.js` - Configuration validation
- **Created**: `test-real-drive.js` - Comprehensive API testing

## API Endpoints

### Available Endpoints
All endpoints require API key authentication (except health check):

#### Core Operations
- `GET/POST /actions/drive/search` - Search files in Drive
- `GET/POST /actions/drive/content` - Get file content
- `POST /actions/drive/upload` - Upload files to Drive
- `POST /actions/drive/modify` - Modify existing files
- `POST /actions/drive/convert` - Convert file formats
- `POST /actions/drive/research` - Research and analyze files

#### File Management
- `POST /actions/drive/rename` - Rename files
- `POST /actions/drive/move` - Move files between folders
- `POST /actions/drive/duplicate` - Duplicate files
- `DELETE /actions/drive/delete` - Delete files
- `POST /actions/drive/share` - Share files with users
- `POST /actions/drive/comment` - Add comments to files

#### Administrative
- `GET /actions/drive/permissions/audit` - Audit file permissions
- `GET /health/drive` - Health check (no auth required)

### Health Check Response
```json
{
  "ok": true,
  "status": "healthy",
  "service": "google-drive",
  "details": {
    "authentication": true,
    "folderAccess": true,
    "environment": {
      "hasServiceAccount": true,
      "hasImpersonateUser": true,
      "hasDriveFolder": true,
      "impersonateUser": "zero@balizero.com",
      "driveFolder": "1UGbm5er6Go351S57GQKUjmxMxHyT4QZb"
    }
  },
  "timestamp": "2025-01-19T..."
}
```

## Environment Configuration

### Required Environment Variables
```bash
# Google Drive Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/zantara-team-key.json
MEMORY_DRIVE_FOLDER_ID=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb
IMPERSONATE_USER=zero@balizero.com

# Alternative configurations
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json
GMAIL_SENDER=zero@balizero.com  # Fallback for IMPERSONATE_USER
```

### Production Deployment
The implementation includes automated setup scripts:

1. **Configuration Validation**: `node validate-drive-config.js`
2. **Production Setup**: `./setup-drive-production.sh`
3. **API Testing**: `node test-real-drive.js`

## Security Features

### Error Handling
- Comprehensive error categorization (401, 403, 404, 500)
- Sanitized error responses (no sensitive data exposure)
- Detailed logging for debugging
- Environment validation before operations

### Authentication Security
- Service account with minimal required permissions
- Domain-wide delegation with specific scopes
- No user credentials stored or transmitted
- Automatic token refresh handling

### Logging
- Structured logging with request correlation
- Success/failure tracking
- Performance metrics
- Security event logging

## Testing

### Validation Tools
1. **Configuration Validator**: Checks environment setup
2. **API Connection Test**: Validates authentication and folder access
3. **Health Check Endpoint**: Continuous monitoring
4. **Integration Tests**: Full end-to-end testing

### Test Coverage
- ✅ Service account authentication
- ✅ Domain-wide delegation
- ✅ Folder access permissions
- ✅ File upload/download operations
- ✅ Search functionality
- ✅ Error handling scenarios

## Deployment

### Prerequisites
1. Google Workspace domain with admin access
2. Service account with domain-wide delegation enabled
3. Required OAuth scopes configured in Google Admin Console
4. Target folder accessible to impersonated user

### Google Admin Console Setup
1. Navigate to **Security > API Controls > Domain-wide Delegation**
2. Add client ID: `[from service account key]`
3. Add OAuth scopes:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.readonly`

### Cloud Run Deployment
```bash
# Run setup script
./setup-drive-production.sh

# Deploy to Cloud Run
./deploy-drive-production.sh
```

## Troubleshooting

### Common Issues

#### 403 Forbidden Errors
- **Cause**: Domain-wide delegation not enabled or scopes not configured
- **Solution**: Configure delegation in Google Admin Console

#### 401 Unauthorized Errors
- **Cause**: Invalid service account key or authentication failure
- **Solution**: Verify service account key and project configuration

#### 404 Not Found Errors
- **Cause**: Target folder not accessible or doesn't exist
- **Solution**: Verify folder ID and user permissions

#### Environment Configuration Issues
- **Cause**: Missing or incorrect environment variables
- **Solution**: Run `node validate-drive-config.js` to diagnose

### Debug Commands
```bash
# Validate configuration
node validate-drive-config.js

# Test API connection
IMPERSONATE_USER=zero@balizero.com node test-real-drive.js

# Check health endpoint
curl https://your-service-url/health/drive

# View logs
gcloud logs read --project=involuted-box-469105-r0 --service=zantara-bridge
```

## Performance Considerations

### Optimization Features
- Efficient API calls with minimal data transfer
- Content truncation for large files (50KB limit)
- Paginated search results
- Proper timeout handling
- Connection pooling via google-auth-library

### Rate Limiting
- Google Drive API quotas automatically handled
- Exponential backoff for retries
- Error responses for quota exceeded scenarios

## Security Compliance

### Data Handling
- No persistent storage of user data
- Content truncation for memory management
- Secure credential management
- Audit logging for all operations

### Access Control
- API key authentication required
- Role-based access through environment configuration
- Service account with minimal permissions
- Domain-restricted access via impersonation

## Support and Maintenance

### Monitoring
- Health check endpoint for uptime monitoring
- Structured logging for issue diagnosis
- Error tracking and alerting
- Performance metrics collection

### Updates and Maintenance
- Modular architecture for easy updates
- Comprehensive test suite for regression testing
- Configuration validation tools
- Automated deployment scripts

For technical support or questions about this implementation, refer to:
- Google Drive API Documentation: https://developers.google.com/drive/api
- Google Workspace Admin Console: https://admin.google.com
- Project documentation in this repository