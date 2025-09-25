import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { RatingService } from './rating.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class BackgroundTasksService {
  private readonly logger = new Logger(BackgroundTasksService.name);
  private isRecalculatingAll = false;

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly ratingService: RatingService,
    private readonly metricsService: MetricsService,
  ) {}

  async recalculateAllGameRatings(): Promise<{
    totalGames: number;
    successfulUpdates: number;
    failedUpdates: number;
    duration: number;
  }> {
    if (this.isRecalculatingAll) {
      throw new Error('Bulk recalculation is already in progress');
    }

    this.isRecalculatingAll = true;
    const startTime = Date.now();
    
    try {
      this.logger.log('Starting bulk recalculation of all game ratings');

      // Get all unique game IDs that have reviews
      const gameIds = await this.reviewRepository
        .createQueryBuilder('review')
        .select('DISTINCT review.gameId', 'gameId')
        .getRawMany();

      const totalGames = gameIds.length;
      let successfulUpdates = 0;
      let failedUpdates = 0;

      this.logger.log(`Found ${totalGames} games with reviews to recalculate`);

      // Process games in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < gameIds.length; i += batchSize) {
        const batch = gameIds.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async ({ gameId }) => {
            try {
              await this.metricsService.measureOperation(
                'bulk_recalculate',
                () => this.ratingService.updateGameRating(gameId),
                gameId,
              );
              successfulUpdates++;
              this.logger.debug(`Successfully recalculated rating for game ${gameId}`);
            } catch (error) {
              failedUpdates++;
              this.logger.error(
                `Failed to recalculate rating for game ${gameId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }),
        );

        // Small delay between batches to prevent overwhelming the database
        if (i + batchSize < gameIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;
      
      this.logger.log(
        `Bulk recalculation completed: ${successfulUpdates}/${totalGames} successful, ${failedUpdates} failed, took ${duration}ms`,
      );

      return {
        totalGames,
        successfulUpdates,
        failedUpdates,
        duration,
      };
    } finally {
      this.isRecalculatingAll = false;
    }
  }

  async schedulePeriodicRecalculation(intervalHours: number = 24): Promise<void> {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.logger.log(`Scheduling periodic recalculation every ${intervalHours} hours`);
    
    const runRecalculation = async () => {
      try {
        await this.recalculateAllGameRatings();
      } catch (error) {
        this.logger.error(
          `Scheduled recalculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    };

    // Run immediately on startup
    setTimeout(runRecalculation, 5000); // 5 second delay to allow app to fully start
    
    // Then run periodically
    setInterval(runRecalculation, intervalMs);
  }

  isRecalculationInProgress(): boolean {
    return this.isRecalculatingAll;
  }

  async getRecalculationStatus(): Promise<{
    inProgress: boolean;
    lastMetrics?: ReturnType<MetricsService['getMetricsSummary']>;
  }> {
    return {
      inProgress: this.isRecalculatingAll,
      lastMetrics: this.metricsService.getMetricsSummary(),
    };
  }
}