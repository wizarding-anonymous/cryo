import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { OwnershipService } from '../services/ownership.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { AchievementService } from '../services/achievement.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  database: {
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
  };
  services: {
    libraryService: boolean;
    notificationService: boolean;
    gameCatalogService: boolean;
    achievementService: boolean;
  };
  metrics: {
    totalReviews: number;
    totalRatings: number;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    private readonly ownershipService: OwnershipService,
    private readonly notificationService: NotificationService,
    private readonly gameCatalogService: GameCatalogService,
    private readonly achievementService: AchievementService,
  ) {}

  async getBasicHealth(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const basicHealth = await this.getBasicHealth();
    
    // Check database connectivity
    const databaseHealth = await this.checkDatabaseHealth();
    
    // Check external services
    const servicesHealth = await this.checkServicesHealth();
    
    // Get metrics
    const metrics = await this.getMetrics();

    const overallStatus = databaseHealth.status === 'healthy' && 
                         Object.values(servicesHealth).some(service => service) 
                         ? 'healthy' : 'unhealthy';

    return {
      ...basicHealth,
      status: overallStatus,
      database: databaseHealth,
      services: servicesHealth,
      metrics,
    };
  }

  async getReadiness(): Promise<HealthStatus> {
    // Check if service is ready to accept traffic
    const databaseHealth = await this.checkDatabaseHealth();
    
    return {
      status: databaseHealth.status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  async getLiveness(): Promise<HealthStatus> {
    // Simple liveness check - service is running
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  private async checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTime?: number }> {
    try {
      const startTime = Date.now();
      await this.reviewRepository.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
      };
    }
  }

  private async checkServicesHealth(): Promise<{
    libraryService: boolean;
    notificationService: boolean;
    gameCatalogService: boolean;
    achievementService: boolean;
  }> {
    const [
      libraryHealth,
      notificationHealth,
      gameCatalogHealth,
      achievementHealth,
    ] = await Promise.allSettled([
      this.ownershipService.getServiceHealth(),
      this.notificationService.getServiceHealth(),
      this.gameCatalogService.getServiceHealth(),
      this.achievementService.getServiceHealth(),
    ]);

    return {
      libraryService: libraryHealth.status === 'fulfilled' && 
                     libraryHealth.value.status === 'healthy',
      notificationService: notificationHealth.status === 'fulfilled' && 
                          notificationHealth.value.status === 'healthy',
      gameCatalogService: gameCatalogHealth.status === 'fulfilled' && 
                         gameCatalogHealth.value.status === 'healthy',
      achievementService: achievementHealth.status === 'fulfilled' && 
                         achievementHealth.value.status === 'healthy',
    };
  }

  private async getMetrics(): Promise<{ totalReviews: number; totalRatings: number }> {
    try {
      const [totalReviews, totalRatings] = await Promise.all([
        this.reviewRepository.count(),
        this.gameRatingRepository.count(),
      ]);

      return {
        totalReviews,
        totalRatings,
      };
    } catch (error) {
      this.logger.error('Failed to get metrics:', error);
      return {
        totalReviews: 0,
        totalRatings: 0,
      };
    }
  }
}