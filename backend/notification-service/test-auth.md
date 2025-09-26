# Authentication and Authorization Testing Guide

This document provides examples for testing the authentication and authorization implementation.

## Test Tokens

The system accepts the following test tokens for MVP testing:

- `test-user-1` - Regular user (ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
- `test-user-2` - Regular user (ID: b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22)  
- `test-admin` - Admin user (ID: c2ggde99-9c0b-4ef8-bb6d-6bb9bd380a33)

## Testing Authentication

### 1. Test without Authorization header
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
# Expected: 401 Unauthorized - "Authorization header is required"
```

### 2. Test with invalid Authorization header format
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: InvalidFormat token"
# Expected: 401 Unauthorized - "Bearer token is required"
```

### 3. Test with invalid JWT token
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer invalid"
# Expected: 401 Unauthorized - "Invalid JWT token"
```

### 4. Test with valid JWT token
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-user-1"
# Expected: 200 OK with notifications data
```

## Testing Authorization

### 1. User accessing their own notifications
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-user-1"
# Expected: 200 OK
```

### 2. User trying to access another user's notifications
```bash
curl -X GET http://localhost:3000/notifications/user/b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22 \
  -H "Authorization: Bearer test-user-1"
# Expected: 403 Forbidden - "You can only access your own notifications"
```

### 3. Admin accessing any user's notifications
```bash
curl -X GET http://localhost:3000/notifications/user/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-admin"
# Expected: 200 OK
```

## Testing Admin-only Endpoints

### 1. Regular user trying to create notification directly
```bash
curl -X POST http://localhost:3000/notifications \
  -H "Authorization: Bearer test-user-1" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "type": "system",
    "title": "Test notification",
    "message": "Test message"
  }'
# Expected: 403 Forbidden
```

### 2. Admin creating notification directly
```bash
curl -X POST http://localhost:3000/notifications \
  -H "Authorization: Bearer test-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "type": "system",
    "title": "Test notification",
    "message": "Test message"
  }'
# Expected: 201 Created
```

### 3. Regular user trying to access cache stats
```bash
curl -X GET http://localhost:3000/notifications/cache/stats \
  -H "Authorization: Bearer test-user-1"
# Expected: 403 Forbidden
```

### 4. Admin accessing cache stats
```bash
curl -X GET http://localhost:3000/notifications/cache/stats \
  -H "Authorization: Bearer test-admin"
# Expected: 200 OK with cache statistics
```

## Testing Public Endpoints (Webhooks)

### 1. Payment webhook (no authentication required)
```bash
curl -X POST http://localhost:3000/notifications/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "type": "purchase",
    "title": "Payment received",
    "message": "Your payment has been processed"
  }'
# Expected: 202 Accepted
```

### 2. Social webhook (no authentication required)
```bash
curl -X POST http://localhost:3000/notifications/webhook/social \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "type": "friend_request",
    "title": "New friend request",
    "message": "You have a new friend request"
  }'
# Expected: 202 Accepted
```

## Testing CORS

### 1. Preflight OPTIONS request
```bash
curl -X OPTIONS http://localhost:3000/notifications/user/test-user-id \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
# Expected: 200 OK with CORS headers
```

## Testing Settings Access

### 1. User accessing their own settings
```bash
curl -X GET http://localhost:3000/notifications/settings/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-user-1"
# Expected: 200 OK
```

### 2. User trying to access another user's settings
```bash
curl -X GET http://localhost:3000/notifications/settings/b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22 \
  -H "Authorization: Bearer test-user-1"
# Expected: 403 Forbidden - "You can only access your own settings"
```

### 3. User updating their own settings
```bash
curl -X PUT http://localhost:3000/notifications/settings/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-user-1" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": false,
    "inAppNotifications": true
  }'
# Expected: 200 OK
```

## Testing Cache Management

### 1. User clearing their own cache
```bash
curl -X POST http://localhost:3000/notifications/cache/clear/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-user-1"
# Expected: 204 No Content
```

### 2. User trying to clear another user's cache
```bash
curl -X POST http://localhost:3000/notifications/cache/clear/b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22 \
  -H "Authorization: Bearer test-user-1"
# Expected: 403 Forbidden - "You can only clear your own cache"
```

### 3. Admin clearing any user's cache
```bash
curl -X POST http://localhost:3000/notifications/cache/clear/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  -H "Authorization: Bearer test-admin"
# Expected: 204 No Content
```

## Logging

All operations are logged with the following information:
- HTTP method and URL
- User ID (from JWT token)
- IP address
- User agent
- Response status code
- Response time
- Error details (if any)

Check the application logs to verify that authentication and authorization events are being logged properly.