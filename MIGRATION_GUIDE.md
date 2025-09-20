# 🔄 Migration Guide: AMBARADAM → JWT Authentication

## Overview
The old AMBARADAM magic word authentication has been replaced with industry-standard JWT authentication.

## Breaking Changes

### 1. Authentication Endpoints

**OLD:**
```
POST /identity/login
{
  "name": "user",
  "magicWord": "AMBARADAM"
}
```

**NEW:**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### 2. Authorization Headers

**OLD:**
```
Authorization: Bearer {token-from-ambaradam}
```

**NEW:**
```
Authorization: Bearer {jwt-token}
```

### 3. API Key Authentication

**OLD:**
```
X-Api-Key: hardcoded-key
```

**NEW:**
```
X-Api-Key: {configured-api-key}
# Configure keys in .env: API_KEYS=key1,key2,key3
```

## Migration Steps

### For Clients

1. **Update Authentication Flow:**
   ```javascript
   // OLD
   const response = await fetch('/identity/login', {
     method: 'POST',
     body: JSON.stringify({
       name: 'user',
       magicWord: 'AMBARADAM'
     })
   });
   
   // NEW
   const response = await fetch('/auth/login', {
     method: 'POST',
     body: JSON.stringify({
       email: 'user@example.com',
       password: 'password'
     })
   });
   const { token } = await response.json();
   ```

2. **Store and Use JWT Token:**
   ```javascript
   // Store token
   localStorage.setItem('token', token);
   
   // Use in requests
   fetch('/api/endpoint', {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   });
   ```

3. **Handle Token Expiration:**
   ```javascript
   // Refresh token before expiration
   const refreshToken = async () => {
     const response = await fetch('/auth/refresh', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${currentToken}`
       }
     });
     const { token } = await response.json();
     return token;
   };
   ```

### For Server Deployment

1. **Environment Variables:**
   ```bash
   # Required
   JWT_SECRET=your-super-secret-key-minimum-32-chars
   
   # Optional
   JWT_EXPIRES_IN=24h
   API_KEYS=key1,key2,key3
   ADMIN_EMAILS=admin@example.com
   BOSS_EMAILS=zero@balizero.com
   ```

2. **First Time Setup:**
   ```bash
   # 1. Copy environment template
   cp .env.example .env
   
   # 2. Generate secure JWT secret
   openssl rand -base64 32
   
   # 3. Update .env with your values
   
   # 4. Start server
   npm run build && npm start
   ```

3. **Default Admin Access:**
   - In development, a default admin is created
   - Email: `admin@zantara.local`
   - Password: `changeThisPassword123!`
   - **CHANGE THIS IMMEDIATELY**

## API Changes

### New Endpoints

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user info
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user
- `GET /auth/users` - List users (admin only)

### Protected Routes

All routes now require JWT authentication except:
- `/health` - Health check
- `/auth/*` - Authentication endpoints

### Role-Based Access

```javascript
// Routes now support role requirements
app.use('/admin', requireRole('admin'));
app.use('/boss-only', requireRole('boss'));
app.use('/any-user', authenticateToken);
```

## Security Improvements

1. **No More Hardcoded Secrets** ✅
2. **Bcrypt Password Hashing** ✅
3. **JWT Token Expiration** ✅
4. **Role-Based Access Control** ✅
5. **Environment-Based Configuration** ✅
6. **Request Validation** ✅

## Troubleshooting

### Common Issues

1. **"JWT_SECRET environment variable is required"**
   - Solution: Set JWT_SECRET in .env file

2. **"Invalid token"**
   - Token expired: Use /auth/refresh endpoint
   - Wrong format: Ensure "Bearer " prefix

3. **"Authentication required"**
   - Include Authorization header with valid JWT

4. **"Insufficient permissions"**
   - Check user role matches route requirements

## Support

For issues during migration:
1. Check logs for detailed error messages
2. Verify environment variables are set
3. Test with the /health endpoint first
4. Use /auth/me to verify authentication

## Timeline

- **Phase 1**: Deploy new auth system (COMPLETE)
- **Phase 2**: Update all clients to use JWT
- **Phase 3**: Remove legacy AMBARADAM code
- **Phase 4**: Enable strict authentication on all routes