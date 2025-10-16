# Internal API Documentation

## Overview

The Internal API provides secure endpoints for microservice-to-microservice communication within the User Service. These endpoints are protected by the `InternalServiceGuard` and are designed for high-performance inter-service operations.

## Security

All internal endpoints are protected by `InternalServiceGuard` which supports:

- **API Key Authentication**: Via `Authorization: Bearer <token>` or `x-api-key` header
- **IP Whitelisting**: Configurable allowed IP addresses
- **Internal Service Headers**: Special `x-internal-service` header validation
- **Development Mode**: Automatic localhost access in development/test environments

### Configuration

Set the following environment variables:

```bash
INTERNAL_API_KEYS=key1,key2,key3
INTERNAL_ALLOWED_IPS=127.0.0.1,::1,192.168.1.100
INTERNAL_SERVICE_SECRET=user-service-internal
NODE_ENV=production
```

## Endpoints

### Auth Service Integration

#### Create User
```http
POST /internal/users
Content-Type: application/json
x-internal-service: user-service-internal

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$10$hashedPasswordFromAuthService"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "john@example.com",
  "name": "John Doe",
  "lastLoginAt": null,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Get User by ID
```http
GET /internal/users/{id}
x-internal-service: user-service-internal
```

#### Get User by Email
```http
GET /internal/users/email/{email}
x-internal-service: user-service-internal
```

#### Update Last Login
```http
PATCH /internal/users/{id}/last-login
x-internal-service: user-service-internal
```

### Game Catalog Service Integration

#### Get User Profile
```http
GET /internal/users/{id}/profile?includePrivacySettings=true&includePreferences=true
x-internal-service: user-service-internal
```

**Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "avatarUrl": "https://example.com/avatar.jpg",
  "preferences": {
    "language": "en",
    "timezone": "UTC",
    "theme": "light",
    "gameSettings": {
      "autoDownload": true,
      "cloudSave": true,
      "achievementNotifications": true
    }
  },
  "privacySettings": {
    "profileVisibility": "public",
    "showOnlineStatus": true,
    "showGameActivity": true,
    "allowFriendRequests": true,
    "showAchievements": true
  }
}
```

#### Get Batch Profiles
```http
POST /internal/users/batch/profiles
Content-Type: application/json
x-internal-service: user-service-internal

{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "includePrivacySettings": false,
  "includePreferences": true,
  "chunkSize": 50
}
```

### Payment Service Integration

#### Get Billing Info
```http
GET /internal/users/{id}/billing-info
x-internal-service: user-service-internal
```

**Response:**
```json
{
  "userId": "uuid",
  "email": "john@example.com",
  "name": "John Doe",
  "billingAddress": "123 Main St",
  "paymentMethods": ["card_123", "paypal_456"],
  "currency": "USD",
  "taxId": "TAX123456"
}
```

#### Update Billing Info
```http
PATCH /internal/users/{id}/billing-info
Content-Type: application/json
x-internal-service: user-service-internal

{
  "billingAddress": "456 Oak Ave",
  "currency": "EUR",
  "taxId": "TAX789012"
}
```

### Library Service Integration

#### Get User Preferences
```http
GET /internal/users/{id}/preferences
x-internal-service: user-service-internal
```

#### Update User Preferences
```http
PATCH /internal/users/{id}/preferences
Content-Type: application/json
x-internal-service: user-service-internal

{
  "gameSettings": {
    "autoDownload": false,
    "cloudSave": true,
    "achievementNotifications": false
  }
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/internal/users/invalid-id"
}
```

### Common Error Codes

- `400` - Bad Request (invalid data)
- `401` - Unauthorized (invalid credentials)
- `404` - Not Found (user doesn't exist)
- `409` - Conflict (duplicate email)
- `500` - Internal Server Error

## Performance Considerations

- All endpoints are optimized for high-throughput microservice communication
- Batch operations support chunked processing for large datasets
- Responses exclude sensitive data by default
- Caching is implemented at the service layer for frequently accessed data

## Rate Limiting

Internal endpoints have higher rate limits than public APIs:

- Standard operations: 1000 requests/minute
- Batch operations: 100 requests/minute
- Profile operations: 500 requests/minute

## Monitoring

All internal API calls are logged with:

- Request/response times
- Correlation IDs for tracing
- Service identification
- Error rates and types

Use the `/integrations/metrics` endpoint to monitor internal API performance.