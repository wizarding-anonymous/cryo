# Auth Service API Documentation

## Overview

The Auth Service provides comprehensive authentication and authorization functionality for the Russian Gaming Platform. This service handles user registration, login, session management, and JWT token operations with enterprise-grade security features.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Staging**: `https://api-dev.gaming-platform.ru/api`
- **Production**: `https://api.gaming-platform.ru/api`

## Interactive Documentation

- **Swagger UI**: `{BASE_URL}/docs`
- **OpenAPI JSON**: `{BASE_URL}/docs-json`

## Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer {access_token}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Category | Limit | Window | Purpose |
|------------------|-------|--------|---------|
| Registration | 3 attempts | 15 minutes | Prevent spam registrations |
| Login | 5 attempts | 15 minutes | Prevent brute force attacks |
| Token Refresh | 10 attempts | 1 minute | Allow reasonable token rotation |
| Token Validation | 10 requests | 1 second | Support high-frequency service calls |

## Idempotency

The Auth Service supports idempotency for critical operations to ensure safe retries and prevent duplicate operations. Idempotency is supported for the following endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`

### Using Idempotency

To make an idempotent request, include the `Idempotency-Key` header with a unique identifier:

```
Idempotency-Key: user-registration-2024-01-15-12345
```

**Idempotency Key Requirements:**
- Must be 8-128 characters long
- Can contain letters, numbers, hyphens, and underscores
- Should be unique per operation
- Recommended format: `{operation}-{date}-{unique-id}`

### Idempotency Behavior

1. **First Request**: Operation is executed normally and result is cached for 24 hours
2. **Duplicate Request**: Cached result is returned immediately with same status code and response body
3. **Concurrent Requests**: Returns `409 Conflict` if same key is used simultaneously

### Idempotency Headers

The service returns these headers for idempotent requests:

- `X-Idempotency-Key`: The idempotency key used
- `X-Idempotency-Cached`: `true` if response was cached, `false` if newly generated
- `X-Idempotency-Timestamp`: When the original operation was performed

### Example Idempotent Registration

```bash
curl -X POST https://api.gaming-platform.ru/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: user-reg-2024-01-15-abc123" \
  -d '{
    "name": "Иван Петров",
    "email": "ivan.petrov@example.com", 
    "password": "SecurePass123!"
  }'
```

**First Request Response:**
```
HTTP/1.1 201 Created
X-Idempotency-Key: user-reg-2024-01-15-abc123
X-Idempotency-Cached: false
X-Idempotency-Timestamp: 2024-01-15T10:30:00.000Z

{
  "user": { ... },
  "access_token": "...",
  "refresh_token": "..."
}
```

**Duplicate Request Response:**
```
HTTP/1.1 201 Created
X-Idempotency-Key: user-reg-2024-01-15-abc123
X-Idempotency-Cached: true
X-Idempotency-Timestamp: 2024-01-15T10:30:00.000Z

{
  "user": { ... },
  "access_token": "...",
  "refresh_token": "..."
}
```

### Error Handling with Idempotency

Client errors (4xx) are cached and returned for duplicate requests:

```bash
# First request with invalid data
curl -X POST https://api.gaming-platform.ru/api/auth/register \
  -H "Idempotency-Key: invalid-reg-123" \
  -d '{"email": "invalid-email"}'

# Returns 400 Bad Request

# Duplicate request returns same error
curl -X POST https://api.gaming-platform.ru/api/auth/register \
  -H "Idempotency-Key: invalid-reg-123" \
  -d '{"email": "invalid-email"}'

# Returns cached 400 Bad Request
```

Server errors (5xx) are **not** cached to allow retries when the service recovers.

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "Иван Петров",
  "email": "ivan.petrov@example.com",
  "password": "SecurePass123!"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ivan.petrov@example.com",
    "name": "Иван Петров",
    "lastLoginAt": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session_id": "550e8400-e29b-41d4-a716-446655440001",
  "expires_in": 3600
}
```

#### POST /auth/login
Authenticate user with email and password.

**Request Body:**
```json
{
  "email": "ivan.petrov@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):** Same as registration response.

#### POST /auth/logout
Logout user and invalidate session.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body (Optional):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (204):** No content

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

#### POST /auth/validate
Validate JWT token (for service-to-service calls).

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ivan.petrov@example.com",
    "name": "Иван Петров",
    "lastLoginAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "sessionId": "550e8400-e29b-41d4-a716-446655440001",
  "expiresAt": 1705317600
}
```

### Session Management Endpoints

#### GET /auth/sessions
Get all user sessions.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200):**
```json
{
  "total": 3,
  "active": 2,
  "inactive": 1,
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-01-16T10:30:00.000Z",
      "lastAccessedAt": "2024-01-15T12:45:00.000Z"
    }
  ]
}
```

#### DELETE /auth/sessions/{sessionId}
Invalidate specific session.

**Headers:** `Authorization: Bearer {access_token}`

**Response (204):** No content

#### DELETE /auth/sessions
Invalidate all user sessions.

**Headers:** `Authorization: Bearer {access_token}`

**Response (204):** No content

#### GET /auth/sessions/stats
Get session statistics (admin endpoint).

**Headers:** `Authorization: Bearer {access_token}`

**Response (200):**
```json
{
  "totalActiveSessions": 150,
  "totalExpiredSessions": 45,
  "sessionsPerUser": {
    "user1": 3,
    "user2": 2,
    "user3": 1
  }
}
```

#### GET /auth/sessions/concurrent-info
Get concurrent session information.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200):**
```json
{
  "currentSessionCount": 3,
  "maxAllowedSessions": 5,
  "isAtLimit": false,
  "canCreateNewSession": true,
  "oldestSessionAge": 3600000,
  "sessionsUntilLimit": 2
}
```

#### POST /auth/sessions/invalidate-for-security
Invalidate sessions for security events.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "securityEventType": "password_change",
  "excludeCurrentSession": true
}
```

**Security Event Types:**
- `password_change`: User changed password
- `suspicious_activity`: Detected suspicious patterns
- `account_compromise`: Confirmed account breach
- `admin_action`: Administrative security action

**Response (204):** No content

### Health Check Endpoints

#### GET /health
Comprehensive health check.

**Response (200):**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up", "info": { "used": 45.2, "limit": 150 } },
    "memory_rss": { "status": "up", "info": { "used": 78.5, "limit": 150 } }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up", "info": { "used": 45.2, "limit": 150 } },
    "memory_rss": { "status": "up", "info": { "used": 78.5, "limit": 150 } }
  }
}
```

#### GET /health/ready
Kubernetes readiness probe.

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /health/live
Kubernetes liveness probe.

**Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### GET /health/database
Database health and connection details.

**Response (200):**
```json
{
  "connected": true,
  "responseTime": 45.2,
  "migrations": {
    "upToDate": true,
    "executedMigrations": 5,
    "pendingMigrations": 0,
    "executedMigrationNames": ["CreateUserTable1640995200000"]
  },
  "info": {
    "type": "PostgreSQL",
    "version": "15.4",
    "database": "auth_db",
    "host": "localhost:5432",
    "activeConnections": 10,
    "maxConnections": 20
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Responses

All error responses follow a consistent format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/auth/register",
  "method": "POST",
  "message": "Error description",
  "error": "Error Type"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid input data or validation errors
- **401 Unauthorized**: Invalid credentials or expired tokens
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists (e.g., email in use)
- **429 Too Many Requests**: Rate limit exceeded
- **503 Service Unavailable**: External service unavailable

## Security Features

### Password Requirements
- Minimum 8 characters
- Must contain uppercase letters
- Must contain lowercase letters
- Must contain numbers
- Must contain special characters (@$!%*?&)

### Token Security
- JWT tokens with RS256 signing
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Token blacklisting for immediate invalidation
- Token rotation on refresh

### Session Management
- Maximum 5 concurrent sessions per user
- IP address and user agent tracking
- Automatic session cleanup
- Security event logging

### Rate Limiting
- IP-based rate limiting
- Different limits for different endpoints
- Exponential backoff for repeated violations

## Integration Examples

### Frontend Authentication Flow

```javascript
// 1. Register/Login
const authResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { access_token, refresh_token } = await authResponse.json();

// 2. Store tokens securely
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);

// 3. Use access token for API calls
const apiResponse = await fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

// 4. Handle token refresh
if (apiResponse.status === 401) {
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: refresh_token
    })
  });
  
  const { access_token: newToken } = await refreshResponse.json();
  localStorage.setItem('access_token', newToken);
}
```

### Service-to-Service Token Validation

```javascript
// Validate token from another service
const validateResponse = await fetch('/api/auth/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: receivedToken
  })
});

if (validateResponse.ok) {
  const { valid, user } = await validateResponse.json();
  if (valid) {
    // Token is valid, proceed with request
    console.log('Authenticated user:', user);
  }
}
```

## Monitoring and Observability

### Health Checks
- Use `/health` for load balancer health checks
- Use `/health/ready` for Kubernetes readiness probes
- Use `/health/live` for Kubernetes liveness probes

### Metrics
- Session statistics via `/auth/sessions/stats`
- Database statistics via `/health/database/statistics`
- Circuit breaker status via `/health/circuit-breakers`

### Logging
- All authentication events are logged
- Failed login attempts are tracked
- Security events are recorded with context
- Rate limit violations are monitored

## Support

For API support and questions:
- **Documentation**: Available at `/api/docs`
- **GitHub**: [Auth Service Repository](https://github.com/gaming-platform/auth-service)
- **Email**: support@gaming-platform.ru

## Changelog

### v1.0.0 (Current)
- Initial release with full authentication functionality
- JWT token management with blacklisting
- Session management with concurrent limits
- Comprehensive health checks and monitoring
- Rate limiting and security features