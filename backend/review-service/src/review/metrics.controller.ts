import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';
import { RatingSchedulerService } from '../services/rating-scheduler.service';
import { RatingService } from '../services/rating.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly ratingSchedulerService: RatingSchedulerService,
    private readonly ratingService: RatingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics in text format' })
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get rating metrics summary' })
  @ApiResponse({ status: 200, description: 'Rating metrics summary' })
  async getMetricsSummary() {
    const [ratingMetrics, cacheStats, schedulerStatus] = await Promise.all([
      this.metricsService.getRatingMetricsSummary(),
      this.ratingService.getCacheStatistics(),
      this.ratingSchedulerService.getSchedulerStatus(),
    ]);

    return {
      rating: ratingMetrics,
      cache: cacheStats,
      scheduler: schedulerStatus,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get rating system health status' })
  @ApiResponse({ status: 200, description: 'Health status of rating system components' })
  async getHealthStatus() {
    try {
      const [ratingMetrics, cacheStats] = await Promise.all([
        this.metricsService.getRatingMetricsSummary(),
        this.ratingService.getCacheStatistics(),
      ]);

      const isHealthy = {
        metrics: true,
        cache: cacheStats.cacheHitRate > 0.5, // Считаем здоровым если hit rate > 50%
        calculations: ratingMetrics.activeCalculations < 100, // Не более 100 активных вычислений
        scheduler: !this.ratingSchedulerService.getSchedulerStatus().isRecalculationRunning,
      };

      const overallHealth = Object.values(isHealthy).every(status => status);

      return {
        status: overallHealth ? 'healthy' : 'degraded',
        components: isHealthy,
        metrics: {
          totalCalculations: ratingMetrics.totalCalculations,
          activeCalculations: ratingMetrics.activeCalculations,
          cacheHitRate: cacheStats.cacheHitRate,
          cachedRatings: ratingMetrics.cachedRatingsCount,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get health status', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('recalculate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger rating recalculation for specific games' })
  @ApiResponse({ status: 200, description: 'Recalculation results' })
  async triggerRecalculation(@Body() body: { gameIds: string[] }) {
    const { gameIds } = body;
    
    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return {
        error: 'gameIds array is required and must not be empty',
        timestamp: new Date().toISOString(),
      };
    }

    if (gameIds.length > 100) {
      return {
        error: 'Maximum 100 games can be recalculated at once',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const result = await this.ratingSchedulerService.recalculateRatingsForGames(gameIds);
      
      return {
        success: true,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Manual recalculation failed', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('cache/preload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preload popular game ratings into cache' })
  @ApiResponse({ status: 200, description: 'Cache preload results' })
  async preloadCache() {
    try {
      await this.ratingService.preloadPopularGameRatings();
      
      return {
        success: true,
        message: 'Popular game ratings preloaded into cache',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Cache preload failed', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('performance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed performance metrics' })
  @ApiResponse({ status: 200, description: 'Detailed performance metrics' })
  async getPerformanceMetrics() {
    try {
      const [summary, cacheStats] = await Promise.all([
        this.metricsService.getRatingMetricsSummary(),
        this.ratingService.getCacheStatistics(),
      ]);

      // Вычисляем производительность
      const calculationsPerSecond = summary.totalCalculations > 0 && summary.averageCalculationTime > 0
        ? 1 / summary.averageCalculationTime
        : 0;

      const cacheEfficiency = cacheStats.cacheHitRate * 100;

      return {
        performance: {
          calculationsPerSecond: Math.round(calculationsPerSecond * 100) / 100,
          averageCalculationTime: Math.round(summary.averageCalculationTime * 1000) / 1000, // в секундах
          cacheEfficiency: Math.round(cacheEfficiency * 100) / 100, // в процентах
          activeCalculations: summary.activeCalculations,
        },
        totals: {
          totalCalculations: summary.totalCalculations,
          totalCacheOperations: summary.totalCacheOperations,
          cachedRatings: summary.cachedRatingsCount,
        },
        recommendations: this.generatePerformanceRecommendations(summary, cacheStats),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private generatePerformanceRecommendations(
    summary: any,
    cacheStats: any
  ): string[] {
    const recommendations: string[] = [];

    if (cacheStats.cacheHitRate < 0.7) {
      recommendations.push('Consider increasing cache TTL or preloading more popular games');
    }

    if (summary.averageCalculationTime > 0.1) {
      recommendations.push('Rating calculations are slow, consider database optimization');
    }

    if (summary.activeCalculations > 50) {
      recommendations.push('High number of active calculations, consider rate limiting');
    }

    if (summary.totalCalculations > 10000 && cacheStats.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate with high calculation volume, review caching strategy');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance metrics look good');
    }

    return recommendations;
  }
}