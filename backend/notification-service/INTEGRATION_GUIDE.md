# Notification Service Integration Guide

This guide explains how to integrate with the Notification Service from other microservices in the MVP Russian gaming platform.

## Overview

The Notification Service provides webhook endpoints for all MVP services to send notifications to users. The service supports both in-app and email notifications with user preference management.

## Available Webhook Endpoints

### 1. Payment Service Integration

**Endpoint:** `POST /api/notifications/webhook/payment`

**Purpose:** Send notifications for payment-related events

**Example:**
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/payment \
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

### 2. Social Service Integration

**Endpoint:** `POST /api/notifications/webhook/social`

**Purpose:** Send notifications for social events (friend requests, messages)

**Example:**
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/social \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "friend.request",
    "userId": "user-123",
    "data": {
      "fromUserId": "user-456",
      "fromUserName": "John Doe"
    }
  }'
```

### 3. Achievement Service Integration

**Endpoint:** `POST /api/notifications/webhook/achievement`

**Purpose:** Send notifications when users unlock achievements

**Example:**
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/achievement \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "achievement.unlocked",
    "userId": "user-123",
    "data": {
      "achievementId": "achievement-789",
      "achievementName": "First Victory",
      "achievementDescription": "Win your first game",
      "gameId": "game-456",
      "gameName": "Chess Master"
    }
  }'
```

### 4. Review Service Integration

**Endpoint:** `POST /api/notifications/webhook/review`

**Purpose:** Send notifications for review-related events

**Example:**
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/review \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "review.created",
    "userId": "user-123",
    "data": {
      "reviewId": "review-456",
      "gameId": "game-789",
      "gameName": "The Witcher 3",
      "reviewerName": "Jane Smith",
      "rating": 5
    }
  }'
```

### 5. Game Catalog Service Integration ⭐ NEW

**Endpoint:** `POST /api/notifications/webhook/game-catalog`

**Purpose:** Send notifications for game updates and sales

**Examples:**

Game Update:
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/game-catalog \
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

Game Sale:
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/game-catalog \
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

### 6. Library Service Integration ⭐ NEW

**Endpoint:** `POST /api/notifications/webhook/library`

**Purpose:** Send notifications for library changes

**Examples:**

Game Added to Library:
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/library \
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

Game Removed from Library:
```bash
curl -X POST http://notification-service:3003/api/notifications/webhook/library \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "library.game_removed",
    "userId": "user-123",
    "data": {
      "gameId": "game-456",
      "gameName": "Old Game",
      "removedAt": "2024-01-01T10:00:00Z"
    }
  }'
```

## Integration Service Helper

For TypeScript/NestJS services, you can use the `NotificationIntegrationService`:

```typescript
import { NotificationIntegrationService } from './notification/integration.service';

@Injectable()
export class GameCatalogService {
  constructor(
    private readonly notificationIntegration: NotificationIntegrationService,
  ) {}

  async updateGame(gameId: string, version: string) {
    // Update game logic...
    
    // Notify all users who own this game
    const gameOwners = await this.getGameOwners(gameId);
    
    for (const userId of gameOwners) {
      await this.notificationIntegration.notifyGameUpdate(
        userId,
        gameId,
        'Cyberpunk 2077',
        version,
        'patch'
      );
    }
  }

  async startGameSale(gameId: string, discount: number) {
    // Start sale logic...
    
    // Notify interested users
    const interestedUsers = await this.getInterestedUsers(gameId);
    
    for (const userId of interestedUsers) {
      await this.notificationIntegration.notifyGameSale(
        userId,
        gameId,
        'The Witcher 3',
        discount
      );
    }
  }
}
```

## Event Types

### Game Catalog Events
- `game.updated` - Game has been updated (patch, content update, etc.)
- `game.sale_started` - Game sale has started

### Library Events
- `library.game_added` - Game was added to user's library
- `library.game_removed` - Game was removed from user's library

### Payment Events
- `payment.completed` - Payment was successful
- `payment.failed` - Payment failed
- `payment.refunded` - Payment was refunded

### Social Events
- `friend.request` - Friend request received
- `friend.accepted` - Friend request accepted
- `message.received` - New message received

### Achievement Events
- `achievement.unlocked` - Achievement was unlocked

### Review Events
- `review.created` - New review was created
- `review.replied` - Reply to review was posted

## Notification Channels

The service supports two notification channels:

1. **IN_APP** - In-application notifications (always available)
2. **EMAIL** - Email notifications (requires user email and preferences)

### Channel Selection by Event Type

- **Game Catalog Events**: Both IN_APP and EMAIL (important updates)
- **Library Events**: IN_APP only (immediate feedback)
- **Payment Events**: Both IN_APP and EMAIL (critical notifications)
- **Social Events**: IN_APP only (real-time interactions)
- **Achievement Events**: Both IN_APP and EMAIL (celebrations)
- **Review Events**: IN_APP only (community interactions)

## User Preferences

Users can control their notification preferences through the settings endpoints:

- `GET /api/notifications/settings/{userId}` - Get user preferences
- `PUT /api/notifications/settings/{userId}` - Update user preferences

Available preference categories:
- `inAppNotifications` - Enable/disable in-app notifications
- `emailNotifications` - Enable/disable email notifications
- `friendRequests` - Social notifications
- `gameUpdates` - Game catalog notifications
- `achievements` - Achievement notifications
- `purchases` - Payment notifications
- `systemNotifications` - Library and system notifications

## Error Handling

All webhook endpoints return:
- `202 Accepted` - Event was successfully processed
- `400 Bad Request` - Invalid event data
- `500 Internal Server Error` - Processing failed

The service includes retry logic and will attempt to process notifications even if some channels fail.

## Security

- Webhook endpoints are **public** (no authentication required)
- Internal service-to-service communication should use network-level security
- User data access is protected by JWT authentication for user-facing endpoints

## Monitoring

The service provides cache statistics and health check endpoints for monitoring:
- `GET /api/notifications/cache/stats` (Admin only)
- `GET /health` - Health check endpoint

## Environment Configuration

Required environment variables:
- `NOTIFICATION_SERVICE_URL` - URL of the notification service
- `USER_SERVICE_URL` - URL of the user service (for email lookup)
- `EMAIL_SERVICE_*` - Email service configuration

## Testing

Use the provided integration tests as examples:
- `integration.controller.spec.ts` - Webhook endpoint tests
- `notification.e2e-spec.ts` - End-to-end tests

## Support

For integration support or questions, refer to the notification service logs or contact the platform team.