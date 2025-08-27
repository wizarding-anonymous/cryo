# Developer Portal Service Integration

## Overview

User Service provides basic profile data for developers and publishers to Developer Portal Service through REST API endpoints. This integration allows Developer Portal Service to extend basic profiles with advanced functionality while maintaining User Service as the single source of truth for core user data.

## API Endpoints

### Get Basic Developer Profile

```http
GET /api/v1/developers/{userId}/basic-profile
```

**Headers:**
- `X-API-Key`: Required API key for service authentication

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "companyName": "string",
  "companyType": "individual|llc|corporation",
  "inn": "string",
  "ogrn": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "website": "string",
  "isVerified": "boolean",
  "verificationStatus": "pending|approved|rejected",
  "verifiedAt": "ISO date string",
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

### Get Basic Publisher Profile

```http
GET /api/v1/publishers/{userId}/basic-profile
```

**Headers:**
- `X-API-Key`: Required API key for service authentication

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid", 
  "companyName": "string",
  "companyType": "indie_publisher|aa_publisher|aaa_publisher",
  "corporateInfo": {
    "inn": "string",
    "ogrn": "string",
    "legalAddress": "string",
    "headquarters": "string"
  },
  "contacts": {
    "businessEmail": "string",
    "phone": "string",
    "website": "string"
  },
  "verification": {
    "isVerified": "boolean",
    "status": "pending|approved|rejected",
    "verifiedAt": "ISO date string"
  },
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string"
}
```

## Events

User Service publishes events to Kafka topics for real-time synchronization:

### Developer Verification Changed

**Topic:** `developer.verification.changed`

```json
{
  "userId": "uuid",
  "developerId": "uuid", 
  "oldStatus": "pending|approved|rejected",
  "newStatus": "pending|approved|rejected",
  "verifiedAt": "ISO date string",
  "timestamp": "ISO date string",
  "reason": "string"
}
```

### Developer Profile Updated

**Topic:** `developer.profile.updated`

```json
{
  "userId": "uuid",
  "developerId": "uuid",
  "changedFields": ["field1", "field2"],
  "basicData": {
    "companyName": "string",
    "companyType": "string"
  },
  "timestamp": "ISO date string"
}
```

### Publisher Profile Updated

**Topic:** `publisher.profile.updated`

```json
{
  "userId": "uuid",
  "publisherId": "uuid", 
  "changedFields": ["field1", "field2"],
  "basicData": {
    "companyName": "string",
    "companyType": "string"
  },
  "timestamp": "ISO date string"
}
```

## Rate Limiting

- **Basic endpoints**: 100 requests per minute per IP
- **Integration endpoints**: 200 requests per minute per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Authentication

Integration endpoints require API key authentication via `X-API-Key` header. Contact the User Service team to obtain API keys for your service.

## Error Handling

Standard HTTP status codes:
- `200`: Success
- `401`: Missing or invalid API key
- `403`: Forbidden (invalid API key)
- `404`: Profile not found
- `429`: Rate limit exceeded
- `500`: Internal server error

## Monitoring

Integration health and metrics are available at:
- `GET /api/v1/monitoring/integrations/health`
- `GET /api/v1/monitoring/integrations/events`
- `GET /api/v1/monitoring/integrations/dashboard`