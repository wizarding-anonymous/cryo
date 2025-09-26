/**
 * Integration Examples for Notification Service
 * 
 * This file demonstrates how other microservices can integrate with the notification service
 * to send notifications to users for various events.
 */

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export class NotificationIntegrationExamples {
  private readonly notificationServiceUrl = 'http://localhost:3003/api/notifications';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Example: Game Catalog Service notifying users about game updates
   */
  async exampleGameUpdate() {
    console.log('📦 Game Catalog Service: Notifying users about Cyberpunk 2077 update...');
    
    // Simulate getting all users who own this game
    const gameOwners = ['user-123', 'user-456', 'user-789'];
    
    for (const userId of gameOwners) {
      const gameUpdateEvent = {
        eventType: 'game.updated',
        userId,
        data: {
          gameId: 'cyberpunk-2077',
          gameName: 'Cyberpunk 2077',
          updateType: 'patch',
          version: '2.1.0',
        },
      };

      try {
        await firstValueFrom(
          this.httpService.post(`${this.notificationServiceUrl}/webhook/game-catalog`, gameUpdateEvent)
        );
        console.log(`✅ Game update notification sent to user ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send game update notification to user ${userId}:`, error.message);
      }
    }
  }

  /**
   * Example: Game Catalog Service notifying users about game sales
   */
  async exampleGameSale() {
    console.log('🏷️ Game Catalog Service: Notifying users about The Witcher 3 sale...');
    
    // Simulate getting users interested in this game (wishlist, etc.)
    const interestedUsers = ['user-123', 'user-456'];
    
    for (const userId of interestedUsers) {
      const gameSaleEvent = {
        eventType: 'game.sale_started',
        userId,
        data: {
          gameId: 'witcher-3',
          gameName: 'The Witcher 3: Wild Hunt',
          saleDiscount: 50,
        },
      };

      try {
        await firstValueFrom(
          this.httpService.post(`${this.notificationServiceUrl}/webhook/game-catalog`, gameSaleEvent)
        );
        console.log(`✅ Game sale notification sent to user ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send game sale notification to user ${userId}:`, error.message);
      }
    }
  }

  /**
   * Example: Library Service notifying user about game added to library
   */
  async exampleLibraryGameAdded() {
    console.log('📚 Library Service: Notifying user about game added to library...');
    
    const userId = 'user-123';
    const libraryAddEvent = {
      eventType: 'library.game_added',
      userId,
      data: {
        gameId: 'red-dead-2',
        gameName: 'Red Dead Redemption 2',
        addedAt: new Date().toISOString(),
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/webhook/library`, libraryAddEvent)
      );
      console.log(`✅ Library game added notification sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send library notification to user ${userId}:`, error.message);
    }
  }

  /**
   * Example: Payment Service notifying user about successful purchase
   */
  async examplePaymentCompleted() {
    console.log('💳 Payment Service: Notifying user about successful purchase...');
    
    const userId = 'user-123';
    const paymentEvent = {
      eventType: 'payment.completed',
      userId,
      data: {
        paymentId: 'payment-789',
        gameId: 'cyberpunk-2077',
        gameName: 'Cyberpunk 2077',
        amount: 1999.99,
        currency: 'RUB',
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/webhook/payment`, paymentEvent)
      );
      console.log(`✅ Payment completion notification sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send payment notification to user ${userId}:`, error.message);
    }
  }

  /**
   * Example: Social Service notifying user about friend request
   */
  async exampleFriendRequest() {
    console.log('👥 Social Service: Notifying user about friend request...');
    
    const userId = 'user-123';
    const socialEvent = {
      eventType: 'friend.request',
      userId,
      data: {
        fromUserId: 'user-456',
        fromUserName: 'John Doe',
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/webhook/social`, socialEvent)
      );
      console.log(`✅ Friend request notification sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send social notification to user ${userId}:`, error.message);
    }
  }

  /**
   * Example: Achievement Service notifying user about unlocked achievement
   */
  async exampleAchievementUnlocked() {
    console.log('🏆 Achievement Service: Notifying user about unlocked achievement...');
    
    const userId = 'user-123';
    const achievementEvent = {
      eventType: 'achievement.unlocked',
      userId,
      data: {
        achievementId: 'first-victory',
        achievementName: 'First Victory',
        achievementDescription: 'Win your first game',
        gameId: 'chess-master',
        gameName: 'Chess Master',
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/webhook/achievement`, achievementEvent)
      );
      console.log(`✅ Achievement notification sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send achievement notification to user ${userId}:`, error.message);
    }
  }

  /**
   * Example: Review Service notifying user about new review
   */
  async exampleReviewCreated() {
    console.log('⭐ Review Service: Notifying user about new review...');
    
    const userId = 'user-123'; // Game developer or interested user
    const reviewEvent = {
      eventType: 'review.created',
      userId,
      data: {
        reviewId: 'review-456',
        gameId: 'indie-game',
        gameName: 'My Indie Game',
        reviewerName: 'Jane Smith',
        rating: 5,
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/webhook/review`, reviewEvent)
      );
      console.log(`✅ Review notification sent to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send review notification to user ${userId}:`, error.message);
    }
  }

  /**
   * Run all examples
   */
  async runAllExamples() {
    console.log('🚀 Running all notification integration examples...\n');
    
    try {
      await this.exampleGameUpdate();
      console.log('');
      
      await this.exampleGameSale();
      console.log('');
      
      await this.exampleLibraryGameAdded();
      console.log('');
      
      await this.examplePaymentCompleted();
      console.log('');
      
      await this.exampleFriendRequest();
      console.log('');
      
      await this.exampleAchievementUnlocked();
      console.log('');
      
      await this.exampleReviewCreated();
      console.log('');
      
      console.log('✅ All examples completed successfully!');
    } catch (error) {
      console.error('❌ Error running examples:', error.message);
    }
  }
}

/**
 * Usage example in a NestJS service
 */
export class GameCatalogService {
  constructor(private readonly httpService: HttpService) {}

  async updateGame(gameId: string, version: string, updateType: 'patch' | 'content' | 'hotfix') {
    // Your game update logic here...
    console.log(`Updating game ${gameId} to version ${version}...`);
    
    // Get all users who own this game
    const gameOwners = await this.getGameOwners(gameId);
    const gameName = await this.getGameName(gameId);
    
    // Send notifications to all game owners
    for (const userId of gameOwners) {
      const event = {
        eventType: 'game.updated',
        userId,
        data: {
          gameId,
          gameName,
          updateType,
          version,
        },
      };

      try {
        await firstValueFrom(
          this.httpService.post('http://notification-service:3003/api/notifications/webhook/game-catalog', event)
        );
      } catch (error) {
        console.error(`Failed to send update notification to user ${userId}:`, error.message);
      }
    }
  }

  async startGameSale(gameId: string, discount: number) {
    // Your sale logic here...
    console.log(`Starting ${discount}% sale for game ${gameId}...`);
    
    // Get users interested in this game (wishlist, previous purchases, etc.)
    const interestedUsers = await this.getInterestedUsers(gameId);
    const gameName = await this.getGameName(gameId);
    
    // Send sale notifications
    for (const userId of interestedUsers) {
      const event = {
        eventType: 'game.sale_started',
        userId,
        data: {
          gameId,
          gameName,
          saleDiscount: discount,
        },
      };

      try {
        await firstValueFrom(
          this.httpService.post('http://notification-service:3003/api/notifications/webhook/game-catalog', event)
        );
      } catch (error) {
        console.error(`Failed to send sale notification to user ${userId}:`, error.message);
      }
    }
  }

  // Mock methods for example
  private async getGameOwners(_gameId: string): Promise<string[]> {
    // In real implementation, this would query the database
    return ['user-123', 'user-456', 'user-789'];
  }

  private async getInterestedUsers(_gameId: string): Promise<string[]> {
    // In real implementation, this would query wishlist, similar games owners, etc.
    return ['user-123', 'user-456'];
  }

  private async getGameName(gameId: string): Promise<string> {
    // In real implementation, this would query the game catalog
    const gameNames: Record<string, string> = {
      'cyberpunk-2077': 'Cyberpunk 2077',
      'witcher-3': 'The Witcher 3: Wild Hunt',
      'red-dead-2': 'Red Dead Redemption 2',
    };
    return gameNames[gameId] || 'Unknown Game';
  }
}

/**
 * Usage example in a Library Service
 */
export class LibraryService {
  constructor(private readonly httpService: HttpService) {}

  async addGameToLibrary(userId: string, gameId: string) {
    // Your library logic here...
    console.log(`Adding game ${gameId} to user ${userId} library...`);
    
    const gameName = await this.getGameName(gameId);
    
    // Send notification about game added to library
    const event = {
      eventType: 'library.game_added',
      userId,
      data: {
        gameId,
        gameName,
        addedAt: new Date().toISOString(),
      },
    };

    try {
      await firstValueFrom(
        this.httpService.post('http://notification-service:3003/api/notifications/webhook/library', event)
      );
      console.log(`✅ Library notification sent to user ${userId}`);
    } catch (error) {
      console.error(`Failed to send library notification to user ${userId}:`, error.message);
    }
  }

  private async getGameName(_gameId: string): Promise<string> {
    // Mock implementation
    return 'Sample Game';
  }
}