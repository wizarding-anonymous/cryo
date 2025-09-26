# Notification Service Integration Examples

## Overview

This document provides examples of how MVP services should integrate with the Notification Service using the specialized webhook endpoints.

## Base URL

```
http://notification-service:3000/notifications/webhook
```

## Authentication

Webhook endpoints are public and do not require authentication. However, services should implement webhook signing for security in production.

## Integration Examples

### 1. Payment Service Integration

#### Payment Completed
```typescript
// Payment Service - After successful payment processing
const notifyPaymentCompleted = async (paymentData: PaymentCompletedData) => {
  const webhookPayload = {
    eventType: 'payment.completed',
    userId: paymentData.userId,
    data: {
      paymentId: paymentData.id,
      gameId: paymentData.gameId,
      gameName: paymentData.gameName,
      amount: paymentData.amount,
      currency: paymentData.currency,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/payment/completed',
    webhookPayload
  );
};
```

#### Payment Failed
```typescript
// Payment Service - After failed payment
const notifyPaymentFailed = async (paymentData: PaymentFailedData) => {
  const webhookPayload = {
    eventType: 'payment.failed',
    userId: paymentData.userId,
    data: {
      paymentId: paymentData.id,
      gameId: paymentData.gameId,
      gameName: paymentData.gameName,
      amount: paymentData.amount,
      currency: paymentData.currency,
      errorMessage: paymentData.errorMessage,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/payment/failed',
    webhookPayload
  );
};
```

### 2. Social Service Integration

#### Friend Request
```typescript
// Social Service - When user sends friend request
const notifyFriendRequest = async (friendRequestData: FriendRequestData) => {
  const webhookPayload = {
    eventType: 'friend.request',
    userId: friendRequestData.recipientUserId, // User receiving the request
    data: {
      fromUserId: friendRequestData.senderUserId,
      fromUserName: friendRequestData.senderUserName,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/social/friend-request',
    webhookPayload
  );
};
```

#### Friend Request Accepted
```typescript
// Social Service - When user accepts friend request
const notifyFriendAccepted = async (friendAcceptedData: FriendAcceptedData) => {
  const webhookPayload = {
    eventType: 'friend.accepted',
    userId: friendAcceptedData.originalSenderUserId, // User who sent the original request
    data: {
      fromUserId: friendAcceptedData.accepterUserId,
      fromUserName: friendAcceptedData.accepterUserName,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/social/friend-accepted',
    webhookPayload
  );
};
```

#### New Message
```typescript
// Social Service - When user receives a message
const notifyNewMessage = async (messageData: MessageData) => {
  const webhookPayload = {
    eventType: 'message.received',
    userId: messageData.recipientUserId,
    data: {
      fromUserId: messageData.senderUserId,
      fromUserName: messageData.senderUserName,
      messageId: messageData.messageId,
      messagePreview: messageData.content.substring(0, 50), // First 50 chars
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/social/message',
    webhookPayload
  );
};
```

### 3. Achievement Service Integration

#### Achievement Unlocked
```typescript
// Achievement Service - When user unlocks achievement
const notifyAchievementUnlocked = async (achievementData: AchievementUnlockedData) => {
  const webhookPayload = {
    eventType: 'achievement.unlocked',
    userId: achievementData.userId,
    data: {
      achievementId: achievementData.achievementId,
      achievementName: achievementData.name,
      achievementDescription: achievementData.description,
      gameId: achievementData.gameId,
      gameName: achievementData.gameName,
      points: achievementData.points,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/achievement/unlocked',
    webhookPayload
  );
};
```

### 4. Review Service Integration

#### New Review Created
```typescript
// Review Service - When new review is created
const notifyReviewCreated = async (reviewData: ReviewCreatedData) => {
  // Notify game owners/interested users about new review
  const interestedUserIds = await getInterestedUsers(reviewData.gameId);
  
  for (const userId of interestedUserIds) {
    const webhookPayload = {
      eventType: 'review.created',
      userId: userId,
      data: {
        reviewId: reviewData.reviewId,
        gameId: reviewData.gameId,
        gameName: reviewData.gameName,
        reviewerName: reviewData.reviewerName,
        rating: reviewData.rating,
      }
    };

    await axios.post(
      'http://notification-service:3000/notifications/webhook/review/created',
      webhookPayload
    );
  }
};
```

### 5. Game Catalog Service Integration

#### Game Updated
```typescript
// Game Catalog Service - When game is updated
const notifyGameUpdated = async (gameUpdateData: GameUpdateData) => {
  // Get all users who own this game
  const gameOwners = await getGameOwners(gameUpdateData.gameId);
  
  for (const userId of gameOwners) {
    const webhookPayload = {
      eventType: 'game.updated',
      userId: userId,
      data: {
        gameId: gameUpdateData.gameId,
        gameName: gameUpdateData.gameName,
        updateType: gameUpdateData.updateType, // 'patch', 'content', 'major'
        version: gameUpdateData.version,
      }
    };

    await axios.post(
      'http://notification-service:3000/notifications/webhook/game-catalog/updated',
      webhookPayload
    );
  }
};
```

#### Game Sale Started
```typescript
// Game Catalog Service - When game goes on sale
const notifyGameSaleStarted = async (gameSaleData: GameSaleData) => {
  // Get users interested in this game (wishlist, previous views, etc.)
  const interestedUsers = await getInterestedUsers(gameSaleData.gameId);
  
  for (const userId of interestedUsers) {
    const webhookPayload = {
      eventType: 'game.sale_started',
      userId: userId,
      data: {
        gameId: gameSaleData.gameId,
        gameName: gameSaleData.gameName,
        saleDiscount: gameSaleData.discountPercentage,
      }
    };

    await axios.post(
      'http://notification-service:3000/notifications/webhook/game-catalog/sale-started',
      webhookPayload
    );
  }
};
```

### 6. Library Service Integration

#### Game Added to Library
```typescript
// Library Service - When game is added to user's library
const notifyGameAddedToLibrary = async (libraryData: LibraryAddedData) => {
  const webhookPayload = {
    eventType: 'library.game_added',
    userId: libraryData.userId,
    data: {
      gameId: libraryData.gameId,
      gameName: libraryData.gameName,
      addedAt: new Date().toISOString(),
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/library/game-added',
    webhookPayload
  );
};
```

#### Game Removed from Library
```typescript
// Library Service - When game is removed from user's library
const notifyGameRemovedFromLibrary = async (libraryData: LibraryRemovedData) => {
  const webhookPayload = {
    eventType: 'library.game_removed',
    userId: libraryData.userId,
    data: {
      gameId: libraryData.gameId,
      gameName: libraryData.gameName,
      removedAt: new Date().toISOString(),
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/webhook/library/game-removed',
    webhookPayload
  );
};
```

## Error Handling

All webhook endpoints return HTTP 202 (Accepted) on success. Services should implement retry logic for failed webhook calls:

```typescript
const sendWebhookWithRetry = async (url: string, payload: any, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        timeout: 5000, // 5 second timeout
      });
      
      if (response.status === 202) {
        return response.data;
      }
    } catch (error) {
      console.error(`Webhook attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};
```

## Bulk Notifications (Admin Only)

For system-wide notifications (maintenance, announcements, etc.):

```typescript
// Admin Service - Send notification to multiple users
const sendBulkNotification = async (userIds: string[], notification: NotificationData) => {
  const bulkPayload = {
    userIds: userIds,
    notification: {
      type: 'system',
      title: notification.title,
      message: notification.message,
      channels: ['in_app', 'email'],
      metadata: notification.metadata,
    }
  };

  await axios.post(
    'http://notification-service:3000/notifications/bulk',
    bulkPayload,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      }
    }
  );
};
```

## Testing Integration

Use the notification service's test endpoints to verify integration:

```bash
# Test payment webhook
curl -X POST http://localhost:3000/notifications/webhook/payment/completed \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "payment.completed",
    "userId": "test-user-id",
    "data": {
      "paymentId": "test-payment-id",
      "gameId": "test-game-id",
      "gameName": "Test Game",
      "amount": 1999.99,
      "currency": "RUB"
    }
  }'
```

## Monitoring

Monitor webhook delivery success rates and implement alerting for failed deliveries. The notification service provides statistics endpoints for monitoring.