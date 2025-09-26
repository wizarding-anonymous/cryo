# Notification Service API Documentation

## Overview

The Notification Service provides a comprehensive REST API for managing notifications in the Russian gaming platform MVP. This service supports both in-app and email notifications with user preference management.

**Base URL**: `http://notification-service:3003/api`  
**Version**: 1.0.0  
**Environment**: Production Ready

## Authentication

All user-facing endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Webhook endpoints (for service-to-service communication) are **public** and do not require authentication.

## Core Endpoints

### Health Check

#### GET /health
Check service health status.

**Response:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### User Notifications

#### GET /api/notifications/user/{userId}
Get notifications for a specific user with pagination.

**Parameters:**
- `userId` (path) - User ID
- `limit` (query) - Number of notifications (default: 20, max: 100)
- `offset` (query) - Pagination offset (default: 0)
- `type` (query) - Filter by notification type
- `isRead` (query) - Filter by read status

**Example Request:**
```bash
curl -X GET "http://notification-service:3003/api/notifications/user/user-123?limit=10&isRead=false" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response:**
```json
{
  "data": [
    {
      "id": "notif-456",
      "userId": "user-123",
      "type": "achievement",
      "title": "Достижение разблокировано!",
      "message": "Вы получили достижение 'Первая победа'",
      "isRead": false,
      "priority": "normal",
      "channels": ["in_app", "email"],
      "metadata": {
        "achievementId": "achievement-789",
        "gameId": "game-456"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": null
    }
  ],
  "total": 25,
  "limit": 10,
  "offset": 0
}
```

#### POST /api/notifications
Create a new notification.

**Request Body:**
```json
{
  "userId": "user-123",
  "type": "system",
  "title": "Добро пожаловать!",
  "message": "Спасибо за регистрацию на нашей платформе",
  "priority": "normal",
  "channels": ["in_app", "email"],
  "metadata": {
    "source": "registration"
  },
  "expiresAt": "2024-02-15T10:30:00Z"
}
```

**Response:**
```json
{
  "id": "notif-789",
  "userId": "user-123",
  "type": "system",
  "title": "Добро пожаловать!",
  "message": "Спасибо за регистрацию на нашей платформе",
  "isRead": false,
  "priority": "normal",
  "channels": ["in_app", "email"],
  "metadata": {
    "source": "registration"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2024-02-15T10:30:00Z"
}
```

#### PUT /api/notifications/{id}/read
Mark a notification as read.

**Example Request:**
```bash
curl -X PUT "http://notification-service:3003/api/notifications/notif-456/read" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response:** `204 No Content`

### User Settings

#### GET /api/notifications/settings/{userId}
Get user notification preferences.

**Response:**
```json
{
  "id": "settings-123",
  "userId": "user-123",
  "inAppNotifications": true,
  "emailNotifications": true,
  "friendRequests": true,
  "gameUpdates": true,
  "achievements": true,
  "purchases": true,
  "systemNotifications": true,
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### PUT /api/notifications/settings/{userId}
Update user notification preferences.

**Request Body:**
```json
{
  "emailNotifications": false,
  "gameUpdates": false
}
```

**Response:**
```json
{
  "id": "settings-123",
  "userId": "user-123",
  "inAppNotifications": true,
  "emailNotifications": false,
  "friendRequests": true,
  "gameUpdates": false,
  "achievements": true,
  "purchases": true,
  "systemNotifications": true,
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

## Webhook Endpoints (Service Integration)

### Payment Service Integration

#### POST /api/notifications/webhook/payment
Handle payment-related events.

**Event Types:**
- `payment.completed` - Payment successful
- `payment.failed` - Payment failed
- `payment.refunded` - Payment refunded

**Example - Payment Completed:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/payment" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "payment.completed",
    "userId": "user-123",
    "data": {
      "paymentId": "payment-456",
      "gameId": "game-789",
      "gameName": "Cyberpunk 2077",
      "amount": 1999.99,
      "currency": "RUB"
    }
  }'
```

**Generated Notification:**
- **Title**: "Покупка завершена"
- **Message**: "Игра 'Cyberpunk 2077' успешно добавлена в вашу библиотеку"
- **Channels**: IN_APP + EMAIL
- **Type**: purchase

### Social Service Integration

#### POST /api/notifications/webhook/social
Handle social events.

**Event Types:**
- `friend.request` - Friend request received
- `friend.accepted` - Friend request accepted
- `message.received` - New message received

**Example - Friend Request:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/social" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "friend.request",
    "userId": "user-123",
    "data": {
      "fromUserId": "user-456",
      "fromUserName": "Иван Петров"
    }
  }'
```

**Generated Notification:**
- **Title**: "Новая заявка в друзья"
- **Message**: "Иван Петров хочет добавить вас в друзья"
- **Channels**: IN_APP
- **Type**: friend_request

### Achievement Service Integration

#### POST /api/notifications/webhook/achievement
Handle achievement events.

**Event Types:**
- `achievement.unlocked` - Achievement unlocked

**Example:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/achievement" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "achievement.unlocked",
    "userId": "user-123",
    "data": {
      "achievementId": "achievement-789",
      "achievementName": "Первая победа",
      "achievementDescription": "Выиграйте свою первую игру",
      "gameId": "game-456",
      "gameName": "Chess Master"
    }
  }'
```

**Generated Notification:**
- **Title**: "Достижение разблокировано!"
- **Message**: "Вы получили достижение 'Первая победа' в игре Chess Master"
- **Channels**: IN_APP + EMAIL
- **Type**: achievement

### Review Service Integration

#### POST /api/notifications/webhook/review
Handle review events.

**Event Types:**
- `review.created` - New review created
- `review.replied` - Reply to review posted

**Example:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/review" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "review.created",
    "userId": "user-123",
    "data": {
      "reviewId": "review-456",
      "gameId": "game-789",
      "gameName": "The Witcher 3",
      "reviewerName": "Анна Смирнова",
      "rating": 5
    }
  }'
```

### Game Catalog Service Integration

#### POST /api/notifications/webhook/game-catalog
Handle game catalog events.

**Event Types:**
- `game.updated` - Game updated
- `game.sale_started` - Game sale started

**Example - Game Update:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/game-catalog" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "game.updated",
    "userId": "user-123",
    "data": {
      "gameId": "game-456",
      "gameName": "Cyberpunk 2077",
      "updateType": "patch",
      "version": "2.1.0"
    }
  }'
```

**Example - Game Sale:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/game-catalog" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "game.sale_started",
    "userId": "user-123",
    "data": {
      "gameId": "game-456",
      "gameName": "The Witcher 3",
      "saleDiscount": 50
    }
  }'
```

### Library Service Integration

#### POST /api/notifications/webhook/library
Handle library events.

**Event Types:**
- `library.game_added` - Game added to library
- `library.game_removed` - Game removed from library

**Example:**
```bash
curl -X POST "http://notification-service:3003/api/notifications/webhook/library" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "library.game_added",
    "userId": "user-123",
    "data": {
      "gameId": "game-456",
      "gameName": "Red Dead Redemption 2",
      "addedAt": "2024-01-01T10:00:00Z"
    }
  }'
```

## Data Models

### Notification Types
- `friend_request` - Social notifications
- `game_update` - Game catalog notifications  
- `achievement` - Achievement notifications
- `purchase` - Payment notifications
- `system` - Library and system notifications

### Notification Priorities
- `normal` - Standard priority
- `high` - High priority (critical notifications)

### Notification Channels
- `in_app` - In-application notifications
- `email` - Email notifications

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Notification not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Rate Limiting

- **User endpoints**: 100 requests per minute per user
- **Webhook endpoints**: 1000 requests per minute per service
- **Health check**: No rate limiting

## Integration Examples

### TypeScript/NestJS Integration

```typescript
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationIntegrationService {
  constructor(private readonly httpService: HttpService) {}

  async notifyPaymentCompleted(userId: string, paymentData: any) {
    const payload = {
      eventType: 'payment.completed',
      userId,
      data: paymentData
    };

    return this.httpService.post(
      'http://notification-service:3003/api/notifications/webhook/payment',
      payload
    ).toPromise();
  }

  async notifyAchievementUnlocked(userId: string, achievementData: any) {
    const payload = {
      eventType: 'achievement.unlocked',
      userId,
      data: achievementData
    };

    return this.httpService.post(
      'http://notification-service:3003/api/notifications/webhook/achievement',
      payload
    ).toPromise();
  }
}
```

### Docker Compose Integration

```yaml
version: '3.8'
services:
  notification-service:
    image: notification-service:latest
    ports:
      - "3003:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  your-service:
    image: your-service:latest
    environment:
      - NOTIFICATION_SERVICE_URL=http://notification-service:3000
```

## Performance Characteristics

- **Response Time**: < 200ms (MVP requirement)
- **Throughput**: 1000+ concurrent users
- **Availability**: 99.9% uptime
- **Email Delivery**: 95%+ success rate

## Monitoring

### Metrics Endpoint
- `GET /metrics` - Prometheus metrics

### Key Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `notification_delivery_total` - Notification delivery count
- `email_delivery_success_rate` - Email delivery success rate

## Support

For integration support:
1. Check service logs: `kubectl logs -f deployment/notification-service-deployment`
2. Verify health: `curl http://notification-service:3003/health`
3. Review this documentation
4. Contact platform team

## Changelog

### v1.0.0 (MVP Release)
- ✅ Basic in-app notifications
- ✅ Email notifications via Russian providers
- ✅ User preference management
- ✅ Integration with all MVP services
- ✅ Docker and Kubernetes support
- ✅ 100% test coverage