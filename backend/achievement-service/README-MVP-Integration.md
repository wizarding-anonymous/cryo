# MVP Service Integration Guide

## Overview

This document describes the integration between Achievement Service and other MVP services in the Russian gaming platform. The Achievement Service provides webhook endpoints to receive events from other services and sends notifications about unlocked achievements.

## Integration Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Payment Service│    │  Review Service │    │  Social Service │
│                 │    │                 │    │                 │
│  POST /webhook  │    │  POST /webhook  │    │  POST /webhook  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ Purchase Events      │ Review Events        │ Social Events
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Achievement Service                              │
│                                                                 │
│  POST /integration/payment/purchase                             │
│  POST /integration/review/created                               │
│  POST /integration/social/friend                                │
│  POST /integration/library/update                               │
│  POST /integration/health                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Achievement Notifications
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Notification Service                             │
│                                                                 │
│  POST /api/notifications/achievement                            │
└─────────────────────────────────────────────────────────────────┘
```

## Webhook Endpoints

### 1. Payment Service Integration

**Endpoint:** `POST /integration/payment/purchase`

**Purpose:** Receives notifications about game purchases from Payment Service

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "gameId": "123e4567-e89b-12d3-a456-426614174001",
  "transactionId": "tx-123456",
  "amount": 1999,
  "currency": "RUB",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment purchase event processed successfully"
}
```

**Triggered Achievements:**
- "Первая покупка" (First Purchase)
- "5 игр" (5 Games) - when user reaches 5 games
- Other count-based purchase achievements

### 2. Review Service Integration

**Endpoint:** `POST /integration/review/created`

**Purpose:** Receives notifications about review creation from Review Service

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "reviewId": "123e4567-e89b-12d3-a456-426614174002",
  "gameId": "123e4567-e89b-12d3-a456-426614174001",
  "rating": 5,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review created event processed successfully"
}
```

**Triggered Achievements:**
- "Первый отзыв" (First Review)
- "10 отзывов" (10 Reviews) - when user reaches 10 reviews

### 3. Social Service Integration

**Endpoint:** `POST /integration/social/friend`

**Purpose:** Receives notifications about social events from Social Service

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "friendId": "123e4567-e89b-12d3-a456-426614174003",
  "eventType": "friend_added",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Social event processed successfully"
}
```

**Triggered Achievements:**
- "Первый друг" (First Friend)

**Note:** Only `friend_added` events trigger achievements. `friend_removed` events are ignored in MVP.

### 4. Library Service Integration

**Endpoint:** `POST /integration/library/update`

**Purpose:** Receives notifications about library changes from Library Service

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "gameId": "123e4567-e89b-12d3-a456-426614174001",
  "action": "added",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Library update event processed successfully"
}
```

**Triggered Achievements:**
- Same as payment purchase events (when action is "added")

**Note:** Only `added` actions trigger achievements. `removed` actions are ignored in MVP.

### 5. Health Check

**Endpoint:** `POST /integration/health`

**Purpose:** Health check for integration endpoints

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Notification Service Integration

### Outgoing Webhook

**Endpoint:** `POST /api/notifications/achievement` (on Notification Service)

**Purpose:** Sends achievement unlock notifications to Notification Service

**Request Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "achievementId": "123e4567-e89b-12d3-a456-426614174001",
  "achievementName": "Первая покупка",
  "achievementDescription": "Купите свою первую игру",
  "achievementPoints": 10,
  "unlockedAt": "2024-01-01T00:00:00.000Z",
  "notificationType": "achievement_unlocked"
}
```

**Expected Response:**
```json
{
  "success": true,
  "notificationId": "notif-123456",
  "message": "Notification queued successfully"
}
```

## Library Service Client

The Achievement Service also acts as a client to Library Service to get additional user statistics:

### API Calls to Library Service

1. **Get User Game Count**
   - `GET /api/library/{userId}/count`
   - Used for count-based achievements

2. **Get User Library Stats**
   - `GET /api/library/{userId}/stats`
   - Used for advanced achievement logic

3. **Check Game in Library**
   - `GET /api/library/{userId}/games/{gameId}`
   - Used for verification

## Configuration

### Environment Variables

Add these variables to your environment configuration:

```bash
# MVP Service Integration URLs
NOTIFICATION_SERVICE_URL=http://notification-service:3000
LIBRARY_SERVICE_URL=http://library-service:3000
PAYMENT_SERVICE_URL=http://payment-service:3000
REVIEW_SERVICE_URL=http://review-service:3000
SOCIAL_SERVICE_URL=http://social-service:3000
```

### Development URLs
```bash
NOTIFICATION_SERVICE_URL=http://localhost:3004
LIBRARY_SERVICE_URL=http://localhost:3005
PAYMENT_SERVICE_URL=http://localhost:3006
REVIEW_SERVICE_URL=http://localhost:3007
SOCIAL_SERVICE_URL=http://localhost:3008
```

## Security

### Authentication

- Integration endpoints use `@Public()` decorator to bypass JWT authentication
- Services should authenticate using service-to-service tokens or IP whitelisting
- All requests include `X-Service-Name` header for identification

### Request Headers

All outgoing requests include:
```
Content-Type: application/json
X-Service-Name: achievement-service
X-Service-Version: 1.0.0
```

## Error Handling

### Graceful Degradation

- If Notification Service is unavailable, achievements are still unlocked but notifications fail silently
- If Library Service is unavailable, default values are used (game count = 0)
- All integration failures are logged but don't prevent core achievement functionality

### Retry Logic

Currently, no retry logic is implemented in MVP. Failed notifications are logged and ignored.

**Future Enhancement:** Implement exponential backoff retry for critical integrations.

## Testing

### Manual Testing

Use the provided test script:

```bash
node test-integration.js
```

### Automated Testing

Run integration tests:

```bash
npm run test:e2e -- --testPathPattern="integration-mvp"
```

### Test Data

Use these test UUIDs for consistent testing:
- User ID: `123e4567-e89b-12d3-a456-426614174000`
- Game ID: `123e4567-e89b-12d3-a456-426614174001`
- Review ID: `123e4567-e89b-12d3-a456-426614174002`
- Friend ID: `123e4567-e89b-12d3-a456-426614174003`

## Monitoring

### Logs

All integration events are logged with structured logging:

```
[Achievement Service] Received payment purchase event for user 123e4567-e89b-12d3-a456-426614174000, game 123e4567-e89b-12d3-a456-426614174001
[Achievement Service] Updated 2 progress records for game purchase (total games: 1)
[Achievement Service] Achievement Первая покупка unlocked for user 123e4567-e89b-12d3-a456-426614174000
[Achievement Service] Notification sent successfully for achievement 123e4567-e89b-12d3-a456-426614174001 to user 123e4567-e89b-12d3-a456-426614174000
```

### Health Checks

- Integration health endpoint: `POST /integration/health`
- Service health checks for external dependencies
- Kubernetes readiness/liveness probes supported

## Deployment

### Docker

The service includes all integration dependencies in the Docker image.

### Kubernetes

Update service discovery configuration to include new service URLs:

```yaml
env:
  - name: NOTIFICATION_SERVICE_URL
    value: "http://notification-service:3000"
  - name: LIBRARY_SERVICE_URL
    value: "http://library-service:3000"
```

## Future Enhancements

### Post-MVP Features

1. **Batch Notifications**: Send multiple achievement notifications in a single request
2. **Retry Logic**: Implement exponential backoff for failed integrations
3. **Circuit Breaker**: Prevent cascading failures when services are down
4. **Metrics**: Add Prometheus metrics for integration success/failure rates
5. **Event Sourcing**: Store all integration events for replay and debugging

### Advanced Integrations

1. **Game Service**: Track in-game achievements and progress
2. **Community Service**: Social achievements based on community participation
3. **Tournament Service**: Competition-based achievements
4. **Streaming Service**: Content creation achievements

## Troubleshooting

### Common Issues

1. **Service Not Responding**
   - Check service URLs in environment variables
   - Verify network connectivity between services
   - Check service logs for errors

2. **Achievements Not Unlocking**
   - Verify webhook payload format
   - Check achievement conditions in database
   - Review progress calculation logic

3. **Notifications Not Sent**
   - Check Notification Service availability
   - Verify notification payload format
   - Review notification service logs

### Debug Commands

```bash
# Check service health
curl -X POST http://localhost:3003/integration/health

# Test payment webhook
curl -X POST http://localhost:3003/integration/payment/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"123e4567-e89b-12d3-a456-426614174000","gameId":"123e4567-e89b-12d3-a456-426614174001","transactionId":"tx-123","amount":1999,"currency":"RUB","timestamp":"2024-01-01T00:00:00.000Z"}'

# Check logs
docker logs achievement-service
```

## Support

For integration support, contact the Achievement Service team or check the service logs for detailed error information.