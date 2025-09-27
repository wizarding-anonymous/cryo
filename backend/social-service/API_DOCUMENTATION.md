# Social Service API Documentation

## Overview

Social Service API предоставляет полный набор социальных функций для российской игровой платформы MVP. Включает систему друзей, простые сообщения, онлайн статусы и интеграционные API для других сервисов.

**Base URL**: `http://localhost:3003` (development) / `https://api.gaming-platform.ru/social` (production)

**API Version**: v1

**Authentication**: JWT Bearer tokens для пользовательских API, Internal tokens для интеграционных API

## Table of Contents

1. [Authentication](#authentication)
2. [Friends Management](#friends-management)
3. [Messaging System](#messaging-system)
4. [Online Status](#online-status)
5. [Integration APIs](#integration-apis)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Authentication

### User Authentication
Все пользовательские API требуют JWT токен в заголовке Authorization:

```http
Authorization: Bearer <jwt-token>
```

### Internal Service Authentication
Интеграционные API используют внутренний токен:

```http
x-internal-token: <internal-api-token>
```

## Friends Management

### Send Friend Request

Отправить заявку в друзья другому пользователю.

**Endpoint**: `POST /v1/friends/request`

**Headers**:
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "toUserId": "uuid-of-target-user",
  "message": "Привет! Давай дружить!" // optional
}
```

**Response** (201 Created):
```json
{
  "id": "friendship-request-uuid",
  "userId": "sender-user-uuid",
  "friendId": "target-user-uuid",
  "status": "pending",
  "requestedBy": "sender-user-uuid",
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

**Example**:
```bash
curl -X POST http://localhost:3003/v1/friends/request \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Привет! Хочешь поиграть вместе?"
  }'
```

### Accept Friend Request

Принять входящую заявку в друзья.

**Endpoint**: `POST /v1/friends/accept/{requestId}`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
{
  "id": "friendship-uuid",
  "userId": "current-user-uuid",
  "friendId": "friend-user-uuid",
  "status": "accepted",
  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T10:35:00Z"
}
```

**Example**:
```bash
curl -X POST http://localhost:3003/v1/friends/accept/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Decline Friend Request

Отклонить входящую заявку в друзья.

**Endpoint**: `POST /v1/friends/decline/{requestId}`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (204 No Content)

**Example**:
```bash
curl -X POST http://localhost:3003/v1/friends/decline/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Remove Friend

Удалить пользователя из списка друзей.

**Endpoint**: `DELETE /v1/friends/{friendId}`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (204 No Content)

**Example**:
```bash
curl -X DELETE http://localhost:3003/v1/friends/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Friends List

Получить список друзей с пагинацией и фильтрацией.

**Endpoint**: `GET /v1/friends`

**Query Parameters**:
- `page` (optional): Номер страницы (default: 1)
- `limit` (optional): Количество записей на странице (default: 20, max: 50)
- `status` (optional): Фильтр по статусу (`online`, `offline`, `all`) (default: `all`)

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
{
  "friends": [
    {
      "id": "friendship-uuid",
      "userId": "current-user-uuid",
      "friendId": "friend-user-uuid",
      "status": "accepted",
      "createdAt": "2024-03-15T10:30:00Z",
      "friendInfo": {
        "username": "PlayerName",
        "avatar": "https://cdn.gaming-platform.ru/avatars/player.jpg",
        "onlineStatus": "online",
        "lastSeen": "2024-03-15T12:00:00Z",
        "currentGame": "Counter-Strike 2"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Example**:
```bash
curl -X GET "http://localhost:3003/v1/friends?page=1&limit=10&status=online" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Friend Requests

Получить список входящих заявок в друзья.

**Endpoint**: `GET /v1/friends/requests`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
[
  {
    "id": "request-uuid",
    "userId": "sender-user-uuid",
    "friendId": "current-user-uuid",
    "status": "pending",
    "requestedBy": "sender-user-uuid",
    "message": "Привет! Давай дружить!",
    "createdAt": "2024-03-15T10:30:00Z",
    "senderInfo": {
      "username": "NewPlayer",
      "avatar": "https://cdn.gaming-platform.ru/avatars/newplayer.jpg"
    }
  }
]
```

**Example**:
```bash
curl -X GET http://localhost:3003/v1/friends/requests \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Search Users

Поиск пользователей по имени для добавления в друзья.

**Endpoint**: `GET /v1/friends/search`

**Query Parameters**:
- `q` (required): Поисковый запрос (минимум 2 символа)

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
[
  {
    "userId": "user-uuid",
    "username": "PlayerName",
    "avatar": "https://cdn.gaming-platform.ru/avatars/player.jpg",
    "onlineStatus": "online",
    "friendshipStatus": "none", // none, pending, friends
    "mutualFriends": 5
  }
]
```

**Example**:
```bash
curl -X GET "http://localhost:3003/v1/friends/search?q=Player" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Messaging System

### Send Message

Отправить сообщение другу.

**Endpoint**: `POST /v1/messages`

**Headers**:
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "toUserId": "friend-user-uuid",
  "content": "Привет! Как дела? Хочешь поиграть в CS2?"
}
```

**Response** (201 Created):
```json
{
  "id": "message-uuid",
  "fromUserId": "sender-user-uuid",
  "toUserId": "friend-user-uuid",
  "content": "Привет! Как дела? Хочешь поиграть в CS2?",
  "isRead": false,
  "createdAt": "2024-03-15T12:30:00Z"
}
```

**Example**:
```bash
curl -X POST http://localhost:3003/v1/messages \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "123e4567-e89b-12d3-a456-426614174000",
    "content": "Привет! Хочешь поиграть вместе?"
  }'
```

### Get Conversations

Получить список диалогов с друзьями.

**Endpoint**: `GET /v1/messages/conversations`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
[
  {
    "friendId": "friend-user-uuid",
    "friendInfo": {
      "username": "PlayerName",
      "avatar": "https://cdn.gaming-platform.ru/avatars/player.jpg",
      "onlineStatus": "online"
    },
    "lastMessage": {
      "id": "message-uuid",
      "fromUserId": "friend-user-uuid",
      "toUserId": "current-user-uuid",
      "content": "Да, давай! Создавай лобби",
      "isRead": false,
      "createdAt": "2024-03-15T12:35:00Z"
    },
    "unreadCount": 3
  }
]
```

**Example**:
```bash
curl -X GET http://localhost:3003/v1/messages/conversations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Conversation

Получить историю сообщений с конкретным другом.

**Endpoint**: `GET /v1/messages/conversations/{friendId}`

**Query Parameters**:
- `page` (optional): Номер страницы (default: 1)
- `limit` (optional): Количество сообщений на странице (default: 50, max: 100)

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
{
  "messages": [
    {
      "id": "message-uuid",
      "fromUserId": "current-user-uuid",
      "toUserId": "friend-user-uuid",
      "content": "Привет! Как дела?",
      "isRead": true,
      "readAt": "2024-03-15T12:32:00Z",
      "createdAt": "2024-03-15T12:30:00Z"
    },
    {
      "id": "message-uuid-2",
      "fromUserId": "friend-user-uuid",
      "toUserId": "current-user-uuid",
      "content": "Привет! Все отлично, хочешь поиграть?",
      "isRead": false,
      "createdAt": "2024-03-15T12:35:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Example**:
```bash
curl -X GET "http://localhost:3003/v1/messages/conversations/123e4567-e89b-12d3-a456-426614174000?page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Mark Message as Read

Отметить сообщение как прочитанное.

**Endpoint**: `PUT /v1/messages/{messageId}/read`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (204 No Content)

**Example**:
```bash
curl -X PUT http://localhost:3003/v1/messages/123e4567-e89b-12d3-a456-426614174000/read \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Online Status

### Set Online Status

Установить статус "онлайн" с информацией о текущей игре.

**Endpoint**: `PUT /v1/status/online`

**Headers**:
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "currentGame": "Counter-Strike 2" // optional
}
```

**Response** (200 OK)

**Example**:
```bash
curl -X PUT http://localhost:3003/v1/status/online \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentGame": "Counter-Strike 2"
  }'
```

### Set Offline Status

Установить статус "офлайн".

**Endpoint**: `PUT /v1/status/offline`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK)

**Example**:
```bash
curl -X PUT http://localhost:3003/v1/status/offline \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get Friends Status

Получить онлайн статусы всех друзей.

**Endpoint**: `GET /v1/status/friends`

**Headers**:
```http
Authorization: Bearer <jwt-token>
```

**Response** (200 OK):
```json
[
  {
    "userId": "friend-user-uuid",
    "username": "PlayerName",
    "status": "online",
    "lastSeen": "2024-03-15T12:40:00Z",
    "currentGame": "Counter-Strike 2"
  },
  {
    "userId": "friend-user-uuid-2",
    "username": "AnotherPlayer",
    "status": "away",
    "lastSeen": "2024-03-15T12:25:00Z",
    "currentGame": null
  }
]
```

**Example**:
```bash
curl -X GET http://localhost:3003/v1/status/friends \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Integration APIs

### Achievement Service Integration

#### Get Friends for Achievements

Получить список друзей для расчета достижений.

**Endpoint**: `GET /integration/achievement/{userId}/friends`

**Headers**:
```http
x-internal-token: <internal-api-token>
```

**Response** (200 OK):
```json
{
  "userId": "user-uuid",
  "friends": [
    {
      "friendId": "friend-uuid",
      "friendshipDate": "2024-03-15T10:30:00Z",
      "isActive": true
    }
  ],
  "totalFriends": 15,
  "cachedAt": "2024-03-15T12:40:00Z"
}
```

**Example**:
```bash
curl -X GET http://localhost:3003/integration/achievement/123e4567-e89b-12d3-a456-426614174000/friends \
  -H "x-internal-token: internal-api-secret-token"
```

#### First Friend Achievement Webhook

Уведомить Achievement Service о первом друге пользователя.

**Endpoint**: `POST /integration/achievement/webhook/first-friend`

**Headers**:
```http
x-internal-token: <internal-api-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "userId": "user-uuid",
  "friendId": "friend-uuid",
  "timestamp": "2024-03-15T10:30:00Z"
}
```

**Response** (200 OK)

### Review Service Integration

#### Check Social Connection

Проверить социальную связь между пользователями для валидации отзывов.

**Endpoint**: `GET /integration/review/{userId}/connections/{targetUserId}`

**Headers**:
```http
x-internal-token: <internal-api-token>
```

**Response** (200 OK):
```json
{
  "userId": "user-uuid",
  "targetUserId": "target-user-uuid",
  "connectionType": "friends", // friends, pending_request, none
  "connectionDate": "2024-03-15T10:30:00Z",
  "canWriteReview": true,
  "metadata": {
    "friendshipDuration": "30 days",
    "mutualFriends": 5
  }
}
```

**Example**:
```bash
curl -X GET http://localhost:3003/integration/review/123e4567-e89b-12d3-a456-426614174000/connections/456e7890-e89b-12d3-a456-426614174001 \
  -H "x-internal-token: internal-api-secret-token"
```

#### Get Mutual Friends Count

Получить количество общих друзей для повышения достоверности отзывов.

**Endpoint**: `GET /integration/review/{userId}/mutual-friends/{targetUserId}`

**Headers**:
```http
x-internal-token: <internal-api-token>
```

**Response** (200 OK):
```json
{
  "userId": "user-uuid",
  "targetUserId": "target-user-uuid",
  "mutualFriendsCount": 8,
  "mutualFriends": [
    {
      "friendId": "mutual-friend-uuid",
      "username": "MutualFriend"
    }
  ],
  "cachedAt": "2024-03-15T12:40:00Z"
}
```

### Notification Service Integration

#### Get Notification Preferences

Получить настройки уведомлений пользователя для социальных событий.

**Endpoint**: `GET /integration/notification/{userId}/preferences`

**Headers**:
```http
x-internal-token: <internal-api-token>
```

**Response** (200 OK):
```json
{
  "userId": "user-uuid",
  "preferences": {
    "friendRequests": {
      "enabled": true,
      "methods": ["push", "email"]
    },
    "friendRequestAccepted": {
      "enabled": true,
      "methods": ["push"]
    },
    "newMessages": {
      "enabled": true,
      "methods": ["push"],
      "onlyWhenOffline": true
    },
    "achievements": {
      "enabled": true,
      "methods": ["push", "email"]
    }
  },
  "updatedAt": "2024-03-15T12:00:00Z"
}
```

## Error Handling

### Standard Error Response

Все ошибки возвращаются в стандартном формате:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "statusCode": 400,
  "timestamp": "2024-03-15T12:40:00Z",
  "path": "/v1/friends/request"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Ошибка валидации входных данных |
| 401 | `UNAUTHORIZED` | Отсутствует или недействительный токен |
| 403 | `FORBIDDEN` | Недостаточно прав для выполнения операции |
| 404 | `NOT_FOUND` | Ресурс не найден |
| 409 | `ALREADY_EXISTS` | Ресурс уже существует |
| 429 | `RATE_LIMIT_EXCEEDED` | Превышен лимит запросов |
| 500 | `INTERNAL_ERROR` | Внутренняя ошибка сервера |

### Specific Error Codes

#### Friends System
- `FRIEND_REQUEST_NOT_FOUND` - Заявка в друзья не найдена
- `ALREADY_FRIENDS` - Пользователи уже друзья
- `FRIEND_REQUEST_EXISTS` - Заявка в друзья уже существует
- `CANNOT_ADD_YOURSELF` - Нельзя добавить себя в друзья
- `USER_NOT_FOUND` - Пользователь не найден

#### Messaging System
- `NOT_FRIENDS` - Пользователи не являются друзьями
- `MESSAGE_NOT_FOUND` - Сообщение не найдено
- `MESSAGE_TOO_LONG` - Сообщение слишком длинное
- `CONVERSATION_NOT_FOUND` - Диалог не найден

#### Status System
- `INVALID_STATUS` - Недопустимый статус
- `STATUS_UPDATE_FAILED` - Не удалось обновить статус

## Rate Limiting

### User API Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Friend Requests | 10 requests | 1 minute |
| Messages | 30 messages | 1 minute |
| Status Updates | 60 updates | 1 minute |
| Search | 20 requests | 1 minute |
| General API | 100 requests | 1 minute |

### Integration API Limits

| Service | Limit | Window |
|---------|-------|--------|
| Achievement Service | 1000 requests | 1 minute |
| Review Service | 500 requests | 1 minute |
| Notification Service | 2000 requests | 1 minute |

### Rate Limit Headers

Все ответы включают заголовки с информацией о лимитах:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1647345600
```

## Examples

### Complete Friend Request Flow

```bash
# 1. Search for users
curl -X GET "http://localhost:3003/v1/friends/search?q=Player" \
  -H "Authorization: Bearer $JWT_TOKEN"

# 2. Send friend request
curl -X POST http://localhost:3003/v1/friends/request \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Привет! Хочешь поиграть вместе?"
  }'

# 3. Check incoming requests (as target user)
curl -X GET http://localhost:3003/v1/friends/requests \
  -H "Authorization: Bearer $TARGET_JWT_TOKEN"

# 4. Accept friend request (as target user)
curl -X POST http://localhost:3003/v1/friends/accept/request-uuid \
  -H "Authorization: Bearer $TARGET_JWT_TOKEN"

# 5. Verify friendship
curl -X GET http://localhost:3003/v1/friends \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Complete Messaging Flow

```bash
# 1. Send message to friend
curl -X POST http://localhost:3003/v1/messages \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "123e4567-e89b-12d3-a456-426614174000",
    "content": "Привет! Хочешь поиграть в CS2?"
  }'

# 2. Get conversations list
curl -X GET http://localhost:3003/v1/messages/conversations \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Get conversation history
curl -X GET http://localhost:3003/v1/messages/conversations/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer $JWT_TOKEN"

# 4. Mark message as read
curl -X PUT http://localhost:3003/v1/messages/message-uuid/read \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Status Management Flow

```bash
# 1. Set online status with current game
curl -X PUT http://localhost:3003/v1/status/online \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentGame": "Counter-Strike 2"
  }'

# 2. Get friends status
curl -X GET http://localhost:3003/v1/status/friends \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Set offline status
curl -X PUT http://localhost:3003/v1/status/offline \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Integration API Examples

```bash
# Achievement Service: Get friends for achievements
curl -X GET http://localhost:3003/integration/achievement/user-uuid/friends \
  -H "x-internal-token: $INTERNAL_TOKEN"

# Review Service: Check social connection
curl -X GET http://localhost:3003/integration/review/user-uuid/connections/target-uuid \
  -H "x-internal-token: $INTERNAL_TOKEN"

# Notification Service: Get preferences
curl -X GET http://localhost:3003/integration/notification/user-uuid/preferences \
  -H "x-internal-token: $INTERNAL_TOKEN"
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { SocialServiceClient } from '@gaming-platform/social-service-sdk';

const client = new SocialServiceClient({
  baseUrl: 'https://api.gaming-platform.ru/social',
  apiKey: 'your-api-key'
});

// Send friend request
const friendRequest = await client.friends.sendRequest({
  toUserId: 'target-user-id',
  message: 'Привет! Хочешь поиграть вместе?'
});

// Send message
const message = await client.messages.send({
  toUserId: 'friend-user-id',
  content: 'Привет! Как дела?'
});

// Update status
await client.status.setOnline({
  currentGame: 'Counter-Strike 2'
});
```

### Python SDK

```python
from gaming_platform_sdk import SocialServiceClient

client = SocialServiceClient(
    base_url='https://api.gaming-platform.ru/social',
    api_key='your-api-key'
)

# Send friend request
friend_request = client.friends.send_request(
    to_user_id='target-user-id',
    message='Привет! Хочешь поиграть вместе?'
)

# Send message
message = client.messages.send(
    to_user_id='friend-user-id',
    content='Привет! Как дела?'
)

# Update status
client.status.set_online(current_game='Counter-Strike 2')
```

## Health Checks

### Basic Health Check

**Endpoint**: `GET /v1/health`

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T12:40:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Detailed Health Check

**Endpoint**: `GET /v1/health/detailed`

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T12:40:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "dependencies": {
    "database": {
      "status": "ok",
      "responseTime": "5ms"
    },
    "redis": {
      "status": "ok",
      "responseTime": "2ms"
    },
    "userService": {
      "status": "ok",
      "responseTime": "15ms"
    },
    "notificationService": {
      "status": "ok",
      "responseTime": "12ms"
    }
  }
}
```

## Swagger Documentation

Интерактивная документация API доступна по адресу:
- Development: http://localhost:3003/api/docs
- Production: https://api.gaming-platform.ru/social/api/docs

## Support

Для получения поддержки по API:
- **Email**: api-support@gaming-platform.ru
- **Telegram**: @gaming_platform_dev
- **GitHub Issues**: https://github.com/gaming-platform/social-service/issues

## Changelog

### v1.0.0 (2024-03-15)
- ✅ Initial MVP release
- ✅ Friends management system
- ✅ Simple messaging between friends
- ✅ Online status tracking
- ✅ Integration APIs for Achievement, Review, and Notification services
- ✅ Rate limiting and security features
- ✅ Comprehensive error handling
- ✅ Performance optimizations for 1000+ concurrent users