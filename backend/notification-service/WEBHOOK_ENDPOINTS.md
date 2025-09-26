# Notification Service - Specialized Webhook Endpoints

## Overview

This document describes the specialized webhook endpoints implemented for MVP service integration. Each endpoint is designed to handle specific events from different microservices in the gaming platform.

## Implemented Endpoints

### 1. Payment Service Webhooks

#### Payment Completed
- **URL**: `POST /notifications/webhook/payment/completed`
- **Purpose**: Handle successful payment notifications
- **Notification Type**: `PURCHASE`
- **Channels**: In-App + Email
- **Message**: "Ваша покупка игры "{gameName}" на сумму {amount} {currency} успешно завершена. Игра добавлена в вашу библиотеку."

#### Payment Failed
- **URL**: `POST /notifications/webhook/payment/failed`
- **Purpose**: Handle failed payment notifications
- **Notification Type**: `PURCHASE`
- **Channels**: In-App + Email
- **Message**: "Не удалось завершить покупку игры "{gameName}". {errorMessage}"

### 2. Social Service Webhooks

#### Friend Request
- **URL**: `POST /notifications/webhook/social/friend-request`
- **Purpose**: Handle friend request notifications
- **Notification Type**: `FRIEND_REQUEST`
- **Channels**: In-App only
- **Message**: "Пользователь {fromUserName} хочет добавить вас в друзья. Примите или отклоните заявку в разделе "Друзья"."

#### Friend Request Accepted
- **URL**: `POST /notifications/webhook/social/friend-accepted`
- **Purpose**: Handle friend acceptance notifications
- **Notification Type**: `FRIEND_REQUEST`
- **Channels**: In-App only
- **Message**: "{fromUserName} принял вашу заявку в друзья! Теперь вы можете играть вместе и обмениваться сообщениями."

#### New Message
- **URL**: `POST /notifications/webhook/social/message`
- **Purpose**: Handle new message notifications
- **Notification Type**: `SYSTEM`
- **Channels**: In-App only
- **Message**: "{fromUserName}: {messagePreview}"

### 3. Achievement Service Webhooks

#### Achievement Unlocked
- **URL**: `POST /notifications/webhook/achievement/unlocked`
- **Purpose**: Handle achievement unlock notifications
- **Notification Type**: `ACHIEVEMENT`
- **Channels**: In-App only
- **Message**: "Поздравляем! Вы получили достижение "{achievementName}" в игре "{gameName}". {achievementDescription} (+{points} очков)"

### 4. Review Service Webhooks

#### Review Created
- **URL**: `POST /notifications/webhook/review/created`
- **Purpose**: Handle new review notifications
- **Notification Type**: `SYSTEM`
- **Channels**: In-App only
- **Message**: "{reviewerName} оставил отзыв ({rating}/5 звезд) на игру "{gameName}". Посмотрите, что думают другие игроки!"

### 5. Game Catalog Service Webhooks

#### Game Updated
- **URL**: `POST /notifications/webhook/game-catalog/updated`
- **Purpose**: Handle game update notifications
- **Notification Type**: `GAME_UPDATE`
- **Channels**: In-App + Email
- **Message**: "Доступно обновление {version} для игры "{gameName}". {updateType === 'patch' ? 'Исправления и улучшения' : 'Новый контент'} уже ждут вас!"

#### Game Sale Started
- **URL**: `POST /notifications/webhook/game-catalog/sale-started`
- **Purpose**: Handle game sale notifications
- **Notification Type**: `GAME_UPDATE`
- **Channels**: In-App + Email
- **Message**: "Скидка {saleDiscount}% на игру "{gameName}"! Не упустите возможность приобрести игру по выгодной цене."

### 6. Library Service Webhooks

#### Game Added to Library
- **URL**: `POST /notifications/webhook/library/game-added`
- **Purpose**: Handle game addition to library notifications
- **Notification Type**: `SYSTEM`
- **Channels**: In-App only
- **Message**: "Игра "{gameName}" успешно добавлена в вашу библиотеку. Теперь вы можете скачать и играть!"

#### Game Removed from Library
- **URL**: `POST /notifications/webhook/library/game-removed`
- **Purpose**: Handle game removal from library notifications
- **Notification Type**: `SYSTEM`
- **Channels**: In-App only
- **Message**: "Игра "{gameName}" была удалена из вашей библиотеки."

## Additional Features

### Bulk Notifications (Admin Only)
- **URL**: `POST /notifications/bulk`
- **Purpose**: Send notifications to multiple users at once
- **Authentication**: Admin JWT required
- **Use Case**: System announcements, maintenance notifications

### User Statistics
- **URL**: `GET /notifications/stats/:userId`
- **Purpose**: Get notification statistics for a user
- **Returns**: Total, unread count, breakdown by type

### Cache Management (Admin Only)
- **URL**: `GET /notifications/cache/stats`
- **Purpose**: Get cache statistics
- **Authentication**: Admin JWT required

- **URL**: `POST /notifications/cache/clear/:userId`
- **Purpose**: Clear cache for specific user
- **Authentication**: User or Admin JWT required

## Request/Response Format

### Standard Webhook Response
```json
{
  "status": "accepted"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Authentication

- **Webhook Endpoints**: Public (no authentication required)
- **User Endpoints**: JWT authentication required
- **Admin Endpoints**: JWT authentication + admin role required

## User Settings Respect

All webhook endpoints respect user notification settings:
- If user has disabled a notification type, it won't be created
- If user has disabled email notifications, only in-app notifications are sent
- If user has disabled all notifications, only critical system notifications are sent

## Error Handling

- Invalid payloads return HTTP 400
- Missing required fields return HTTP 400
- Server errors return HTTP 500
- All errors are logged for monitoring

## Testing

Use the provided test script to verify webhook functionality:

```bash
node test-webhooks.js
```

Or run the comprehensive e2e tests:

```bash
npm run test:e2e -- --testNamePattern="Webhook Integration"
```

## Monitoring

Monitor webhook delivery through:
- Application logs
- Cache statistics endpoint
- User notification statistics
- Database metrics

## Security Considerations

1. **Rate Limiting**: Implement rate limiting for webhook endpoints in production
2. **Webhook Signing**: Add webhook signature verification for security
3. **Input Validation**: All inputs are validated using class-validator
4. **SQL Injection Protection**: TypeORM provides protection against SQL injection
5. **XSS Protection**: All user inputs are sanitized

## Performance

- Webhook endpoints are optimized for high throughput
- Bulk operations available for mass notifications
- Redis caching for user settings
- Database indexing on userId and createdAt fields
- Asynchronous email sending to avoid blocking

## Scalability

- Stateless design allows horizontal scaling
- Redis cache can be shared across instances
- Database connection pooling
- Async processing for email notifications
- Bulk operations for efficiency