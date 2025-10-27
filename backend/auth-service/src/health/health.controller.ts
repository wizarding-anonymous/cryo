import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiExtraModels } from '@nestjs/swagger';
import {
  HealthCheckResponseDto,
  ReadinessResponseDto,
  LivenessResponseDto,
  DatabaseHealthResponseDto,
  DatabaseStatisticsDto,
  DatabaseMaintenanceResponseDto,
  CircuitBreakersResponseDto,
  CircuitBreakerStatsDto,
  RedisHealthResponseDto,
} from './dto/health-response.dto';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { DatabaseService } from '../database/database.service';
import { DatabaseOperationsService } from '../database/database-operations.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { RedisService } from '../common/redis/redis.service';
import { RaceConditionMetricsService } from '../common/metrics/race-condition-metrics.service';
import { UserCacheService } from '../common/cache/user-cache.service';

@ApiTags('Health')
@ApiExtraModels(
  HealthCheckResponseDto,
  ReadinessResponseDto,
  LivenessResponseDto,
  DatabaseHealthResponseDto,
  DatabaseStatisticsDto,
  DatabaseMaintenanceResponseDto,
  CircuitBreakersResponseDto,
  CircuitBreakerStatsDto,
  RedisHealthResponseDto,
)
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private databaseService: DatabaseService,
    private databaseOperationsService: DatabaseOperationsService,
    private circuitBreakerService: CircuitBreakerService,
    private redisService: RedisService,
    private raceConditionMetricsService: RaceConditionMetricsService,
    private userCacheService: UserCacheService,
  ) {}

  @Get('docker')
  @ApiOperation({ 
    summary: 'Lightweight health check for Docker',
    description: 'Simple health check endpoint optimized for Docker health checks with minimal resource usage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
        uptime: { type: 'number', example: 12345 }
      }
    }
  })
  async dockerHealthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Check service health',
    description: `
      Comprehensive health check for Auth Service and its dependencies.
      
      **Health Indicators:**
      - Database connectivity and response time
      - Redis connectivity and response time
      - Memory usage (heap and RSS)
      - External service availability (optional)
      
      **Status Codes:**
      - 200: All health indicators are healthy
      - 503: One or more health indicators are unhealthy
      
      **Use Cases:**
      - Load balancer health checks
      - Monitoring system integration
      - Service dependency verification
      - Kubernetes health probes
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy - All health indicators passed',
    type: HealthCheckResponseDto
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is unhealthy - One or more health indicators failed',
    type: HealthCheckResponseDto
  })
  @HealthCheck()
  check() {
    return this.health.check([
      // Check database connection
      () => this.db.pingCheck('database'),
      
      // Check Redis connectivity
      () => this.checkRedisHealth(),
      
      // Check memory usage
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      
      // Check external services (optional - can be enabled when services are running)
      // () => this.http.pingCheck('user-service', 'http://localhost:3002/api/health'),
      // () => this.http.pingCheck('security-service', 'http://localhost:3010/api/health'),
    ]);
  }

  /**
   * Custom Redis health check indicator
   */
  private async checkRedisHealth(): Promise<{ redis: { status: 'up' | 'down'; info?: any } }> {
    try {
      const startTime = Date.now();
      
      // Test Redis connectivity with a simple ping operation
      const testKey = `health-check:${Date.now()}`;
      await this.redisService.set(testKey, 'ping', 5); // 5 second TTL
      const result = await this.redisService.get(testKey);
      await this.redisService.delete(testKey);
      
      const responseTime = Date.now() - startTime;
      
      if (result === 'ping') {
        return {
          redis: {
            status: 'up',
            info: {
              responseTime: `${responseTime}ms`,
              message: 'Redis connection successful',
            },
          },
        };
      } else {
        throw new Error('Redis ping test failed');
      }
    } catch (error) {
      return {
        redis: {
          status: 'down',
          info: {
            error: error.message,
            message: 'Redis connection failed',
          },
        },
      };
    }
  }

  @Get('ready')
  @ApiOperation({ 
    summary: 'Check if service is ready',
    description: `
      Kubernetes readiness probe endpoint.
      
      **Purpose:**
      - Indicates if the service is ready to accept traffic
      - Used by Kubernetes to determine if pod should receive requests
      - Always returns 200 if the service has started successfully
      
      **Use Cases:**
      - Kubernetes readiness probes
      - Load balancer configuration
      - Service mesh integration
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is ready to accept requests',
    type: ReadinessResponseDto
  })
  getReady() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }

  @Get('live')
  @ApiOperation({ 
    summary: 'Check if service is alive',
    description: `
      Kubernetes liveness probe endpoint.
      
      **Purpose:**
      - Indicates if the service process is running
      - Used by Kubernetes to determine if pod should be restarted
      - Simple health check without dependency verification
      
      **Use Cases:**
      - Kubernetes liveness probes
      - Process monitoring
      - Container orchestration
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service process is alive and running',
    type: LivenessResponseDto
  })
  getLive() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('database')
  @ApiOperation({ 
    summary: 'Check database health and connection details',
    description: `
      Comprehensive database health check with detailed information.
      
      **Information Provided:**
      - Connection status and response time
      - Migration status and history
      - Database version and configuration
      - Active connection count
      
      **Use Cases:**
      - Database monitoring
      - Migration verification
      - Performance troubleshooting
      - Connection pool monitoring
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed database health information and statistics',
    type: DatabaseHealthResponseDto
  })
  async getDatabaseHealth() {
    const healthCheck = await this.databaseService.checkHealth();
    const migrationStatus = await this.databaseService.checkMigrations();
    
    let databaseInfo: any;
    try {
      databaseInfo = await this.databaseService.getDatabaseInfo();
    } catch (error) {
      databaseInfo = { error: 'Could not retrieve database info' };
    }

    return {
      ...healthCheck,
      migrations: migrationStatus,
      info: databaseInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('redis')
  @ApiOperation({ 
    summary: 'Check Redis connectivity and performance',
    description: `
      Comprehensive Redis health check with detailed connectivity information.
      
      **Information Provided:**
      - Connection status and response time
      - Redis server information
      - Memory usage statistics
      - Token blacklist statistics
      
      **Use Cases:**
      - Redis monitoring
      - Performance troubleshooting
      - Cache connectivity verification
      - Token blacklist monitoring
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed Redis health information and statistics',
    type: RedisHealthResponseDto
  })
  async getRedisHealth() {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      const testKey = `health-check:detailed:${Date.now()}`;
      await this.redisService.set(testKey, 'health-test', 10);
      const testResult = await this.redisService.get(testKey);
      await this.redisService.delete(testKey);
      
      const responseTime = Date.now() - startTime;
      const connected = testResult === 'health-test';
      
      // Test token blacklist functionality
      let blacklistTest = false;
      try {
        const blacklistTestKey = `test-token-${Date.now()}`;
        await this.redisService.blacklistToken(blacklistTestKey, 5);
        blacklistTest = await this.redisService.isTokenBlacklisted(blacklistTestKey);
      } catch (error) {
        // Blacklist test failed, but connection might still work
      }

      return {
        connected,
        responseTime,
        status: connected ? 'healthy' : 'unhealthy',
        features: {
          basicOperations: connected,
          tokenBlacklist: blacklistTest,
        },
        performance: {
          pingResponseTime: responseTime,
          connectionStatus: connected ? 'active' : 'failed',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: null,
        status: 'unhealthy',
        error: error.message,
        features: {
          basicOperations: false,
          tokenBlacklist: false,
        },
        performance: {
          pingResponseTime: null,
          connectionStatus: 'failed',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('database/statistics')
  @ApiOperation({ 
    summary: 'Get database statistics and monitoring data',
    description: `
      Detailed database usage statistics for monitoring and analytics.
      
      **Statistics Include:**
      - Session counts (total, active, expired)
      - Token blacklist statistics
      - Login attempt metrics
      - Security event counts
      
      **Use Cases:**
      - Performance monitoring
      - Capacity planning
      - Security analytics
      - System optimization
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Comprehensive database usage statistics',
    type: DatabaseStatisticsDto
  })
  async getDatabaseStatistics() {
    const statisticsResult = await this.databaseOperationsService.getDatabaseStatistics();
    
    if (!statisticsResult.success) {
      return {
        status: 'error',
        error: statisticsResult.error,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'success',
      statistics: statisticsResult.data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('database/maintenance')
  @ApiOperation({ 
    summary: 'Perform database maintenance tasks',
    description: `
      Execute automated database maintenance and cleanup tasks.
      
      **Maintenance Tasks:**
      - Cleanup expired sessions
      - Remove old blacklisted tokens
      - Archive old login attempts
      - Cleanup processed security events
      
      **Features:**
      - Automatic task execution
      - Performance metrics
      - Detailed task results
      
      **Note:** This endpoint should be restricted in production environments.
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Database maintenance tasks completed with detailed results',
    type: DatabaseMaintenanceResponseDto
  })
  async performDatabaseMaintenance() {
    const maintenanceResult = await this.databaseOperationsService.performMaintenanceTasks();
    
    if (!maintenanceResult.success) {
      return {
        status: 'error',
        error: maintenanceResult.error,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'success',
      maintenance: maintenanceResult.data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('circuit-breakers')
  @ApiOperation({ 
    summary: 'Get circuit breaker status and statistics',
    description: `
      Comprehensive circuit breaker monitoring and statistics.
      
      **Information Provided:**
      - Circuit breaker states (CLOSED, OPEN, HALF_OPEN)
      - Request success/failure statistics
      - Response time metrics
      - Failure rate calculations
      
      **Circuit Breakers Monitored:**
      - User Service integration
      - Security Service integration
      - Notification Service integration
      
      **Use Cases:**
      - Service reliability monitoring
      - Failure pattern analysis
      - System resilience verification
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Circuit breaker status and statistics for all monitored services',
    type: CircuitBreakersResponseDto
  })
  getCircuitBreakers() {
    const circuitBreakerNames = this.circuitBreakerService.getCircuitBreakerNames();
    const allStats = this.circuitBreakerService.getAllCircuitBreakerStats();
    
    return {
      status: 'success',
      circuitBreakers: {
        count: circuitBreakerNames.length,
        names: circuitBreakerNames,
        statistics: allStats,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('circuit-breakers/:name')
  @ApiOperation({ 
    summary: 'Get specific circuit breaker statistics',
    description: `
      Detailed statistics for a specific circuit breaker.
      
      **Available Circuit Breakers:**
      - user-service
      - security-service  
      - notification-service
      
      **Detailed Metrics:**
      - Current state and state history
      - Request volume and success rates
      - Response time percentiles
      - Failure patterns and recovery times
      
      **Use Cases:**
      - Service-specific monitoring
      - Troubleshooting integration issues
      - Performance optimization
    `
  })
  @ApiParam({ 
    name: 'name', 
    description: 'Circuit breaker name',
    example: 'user-service',
    enum: ['user-service', 'security-service', 'notification-service']
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed statistics for the specified circuit breaker',
    type: CircuitBreakerStatsDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Circuit breaker not found'
  })
  getCircuitBreakerStats(@Param('name') name: string) {
    const stats = this.circuitBreakerService.getCircuitBreakerStats(name);
    
    if (!stats) {
      return {
        status: 'error',
        error: `Circuit breaker '${name}' not found`,
        availableCircuitBreakers: this.circuitBreakerService.getCircuitBreakerNames(),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'success',
      circuitBreaker: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('race-condition-metrics')
  @ApiOperation({ 
    summary: 'Get race condition monitoring metrics',
    description: `
      Comprehensive race condition monitoring and statistics for session management.
      
      **Metrics Provided:**
      - Lock acquisition success/failure rates
      - Lock conflict detection and frequency
      - Average and maximum lock wait times
      - Concurrent session creation events
      - Lock timeout occurrences
      
      **Health Analysis:**
      - Automatic health status assessment
      - Performance issue identification
      - Optimization recommendations
      
      **Use Cases:**
      - Race condition monitoring
      - Performance optimization
      - Concurrent load analysis
      - System reliability verification
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Race condition metrics and health analysis',
  })
  getRaceConditionMetrics() {
    const metrics = this.raceConditionMetricsService.getMetrics();
    const healthStatus = this.raceConditionMetricsService.getHealthStatus();
    const successRate = this.raceConditionMetricsService.getLockSuccessRate();
    const conflictRate = this.raceConditionMetricsService.getLockConflictRate();

    return {
      status: 'success',
      metrics: {
        ...metrics,
        lockSuccessRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        lockConflictRate: Math.round(conflictRate * 100) / 100,
      },
      health: healthStatus,
      analysis: {
        performanceLevel: this.getPerformanceLevel(metrics, successRate, conflictRate),
        recommendations: healthStatus.recommendations,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('race-condition-metrics/prometheus')
  @ApiOperation({ 
    summary: 'Get race condition metrics in Prometheus format',
    description: `
      Race condition metrics formatted for Prometheus monitoring system.
      
      **Prometheus Metrics:**
      - auth_service_lock_attempts_total
      - auth_service_lock_acquisitions_successful_total
      - auth_service_lock_acquisitions_failed_total
      - auth_service_lock_conflicts_total
      - auth_service_lock_wait_time_avg_ms
      - auth_service_lock_wait_time_max_ms
      - auth_service_lock_timeouts_total
      - auth_service_concurrent_session_creations_total
      
      **Use Cases:**
      - Prometheus monitoring integration
      - Grafana dashboard creation
      - Automated alerting setup
      - Long-term metrics storage
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Prometheus-formatted race condition metrics',
    schema: {
      type: 'string',
      example: `# HELP auth_service_lock_attempts_total Total number of lock attempts
# TYPE auth_service_lock_attempts_total counter
auth_service_lock_attempts_total 150

# HELP auth_service_lock_conflicts_total Number of lock conflicts (race conditions)
# TYPE auth_service_lock_conflicts_total counter
auth_service_lock_conflicts_total 5`
    }
  })
  getRaceConditionMetricsPrometheus() {
    return this.raceConditionMetricsService.getPrometheusMetrics();
  }

  @Get('race-condition-metrics/reset')
  @ApiOperation({ 
    summary: 'Reset race condition metrics (Development/Testing only)',
    description: `
      Reset all race condition metrics to zero values.
      
      **Warning:** This endpoint should only be used in development or testing environments.
      In production, metrics should persist for proper monitoring and analysis.
      
      **Reset Metrics:**
      - All lock attempt counters
      - Wait time statistics
      - Conflict and timeout counters
      - Concurrent session creation counters
      
      **Use Cases:**
      - Testing metric collection
      - Development environment cleanup
      - Performance testing preparation
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Race condition metrics have been reset',
  })
  resetRaceConditionMetrics() {
    this.raceConditionMetricsService.resetMetrics();
    
    return {
      status: 'success',
      message: 'Race condition metrics have been reset',
      warning: 'This operation should only be used in development/testing environments',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cache')
  @ApiOperation({ 
    summary: 'Get cache health and statistics',
    description: `
      Comprehensive cache monitoring and statistics for memory leak prevention.
      
      **Task 17.1 Implementation:**
      - LRU cache statistics with memory usage monitoring
      - Hit/miss ratios for both local and Redis cache layers
      - Memory pressure detection and alerting
      - Automatic cleanup and eviction monitoring
      
      **Information Provided:**
      - Local LRU cache size and memory usage
      - Redis distributed cache statistics
      - Hit/miss ratios and performance metrics
      - Memory pressure and health status
      - Recommended actions for optimization
      
      **Use Cases:**
      - Memory leak detection and prevention
      - Cache performance optimization
      - Capacity planning and monitoring
      - System health verification
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Comprehensive cache health information and statistics',
  })
  getCacheHealth() {
    const stats = this.userCacheService.getUserCacheStats();
    const info = this.userCacheService.getCacheInfo();
    const metrics = this.userCacheService.getMetrics();
    
    return {
      status: 'success',
      cache: {
        health: {
          isHealthy: info.isHealthy,
          memoryPressure: Math.round(info.memoryPressure * 100),
          recommendedAction: stats.recommendedAction,
          uptime: Math.floor(info.uptime / 1000), // Convert to seconds
        },
        statistics: {
          localCache: {
            size: stats.localSize,
            maxSize: stats.maxSize,
            memoryUsage: `${Math.round(stats.memoryUsage / 1024)}KB`,
            hitRatio: `${stats.localHitRatio}%`,
            hits: stats.localHits,
            misses: stats.localMisses,
          },
          redisCache: {
            enabled: stats.redisEnabled,
            hitRatio: `${stats.redisHitRatio}%`,
            hits: stats.redisHits,
            misses: stats.redisMisses,
          },
          overall: {
            totalHitRatio: `${stats.hitRatio}%`,
            totalHits: stats.totalHits,
            totalMisses: stats.totalMisses,
            estimatedUsers: stats.estimatedUsers,
            memoryPerUser: `${stats.memoryPerUser}B`,
          },
        },
        performance: info.performance,
        alerts: this.getCacheAlerts(stats, info),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cache/metrics')
  @ApiOperation({ 
    summary: 'Get cache metrics in Prometheus format',
    description: `
      Cache metrics formatted for Prometheus monitoring system.
      
      **Task 17.1 Metrics:**
      - cache_hits_total (local and Redis)
      - cache_misses_total (local and Redis)
      - cache_size_current and cache_size_max
      - cache_memory_usage_bytes
      - cache_memory_pressure_ratio
      - cache_hit_ratio_percent (local, Redis, and overall)
      - cache_healthy (0 or 1)
      
      **Use Cases:**
      - Prometheus monitoring integration
      - Grafana dashboard creation
      - Automated alerting for memory leaks
      - Long-term performance tracking
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Prometheus-formatted cache metrics',
  })
  getCacheMetrics() {
    const metrics = this.userCacheService.getMetrics();
    
    return {
      status: 'success',
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cache/clear')
  @ApiOperation({ 
    summary: 'Clear all cache entries (Development/Testing only)',
    description: `
      Clear all cache entries from both local LRU cache and Redis.
      
      **Warning:** This endpoint should only be used in development or testing environments.
      In production, cache clearing should be done carefully to avoid performance impact.
      
      **Task 17.1 Implementation:**
      - Clears local LRU cache (prevents memory leaks)
      - Clears Redis cache entries with proper namespacing
      - Resets all hit/miss statistics
      - Provides detailed clearing results
      
      **Use Cases:**
      - Testing cache functionality
      - Development environment cleanup
      - Memory leak testing and verification
      - Performance testing preparation
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache has been cleared successfully',
  })
  async clearCache() {
    const statsBefore = this.userCacheService.getUserCacheStats();
    
    await this.userCacheService.clear();
    
    const statsAfter = this.userCacheService.getUserCacheStats();
    
    return {
      status: 'success',
      message: 'Cache cleared successfully',
      details: {
        before: {
          localSize: statsBefore.localSize,
          memoryUsage: `${Math.round(statsBefore.memoryUsage / 1024)}KB`,
          totalHits: statsBefore.totalHits,
          totalMisses: statsBefore.totalMisses,
        },
        after: {
          localSize: statsAfter.localSize,
          memoryUsage: `${Math.round(statsAfter.memoryUsage / 1024)}KB`,
          totalHits: statsAfter.totalHits,
          totalMisses: statsAfter.totalMisses,
        },
        cleared: {
          entries: statsBefore.localSize,
          memoryFreed: `${Math.round((statsBefore.memoryUsage - statsAfter.memoryUsage) / 1024)}KB`,
        },
      },
      warning: 'This operation should only be used in development/testing environments',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate cache alerts based on statistics and health info
   */
  private getCacheAlerts(stats: any, info: any): string[] {
    const alerts: string[] = [];
    
    // Memory pressure alerts
    if (info.memoryPressure > 0.9) {
      alerts.push('CRITICAL: Cache memory pressure > 90%. Immediate action required.');
    } else if (info.memoryPressure > 0.8) {
      alerts.push('WARNING: Cache memory pressure > 80%. Consider increasing cache size.');
    }
    
    // Hit ratio alerts
    if (stats.hitRatio < 50 && stats.totalHits + stats.totalMisses > 100) {
      alerts.push('WARNING: Overall cache hit ratio < 50%. Review cache strategy.');
    }
    
    if (stats.localHitRatio < 30 && stats.localHits + stats.localMisses > 50) {
      alerts.push('INFO: Local cache hit ratio < 30%. Consider increasing local cache size.');
    }
    
    if (stats.redisEnabled && stats.redisHitRatio < 20 && stats.redisHits + stats.redisMisses > 50) {
      alerts.push('INFO: Redis cache hit ratio < 20%. Review Redis TTL configuration.');
    }
    
    // Performance alerts
    if (stats.estimatedUsers > 8000) {
      alerts.push('INFO: Cache approaching capacity with 8000+ users. Monitor for performance impact.');
    }
    
    // Health status
    if (!info.isHealthy) {
      alerts.push('ERROR: Cache is marked as unhealthy. Check memory pressure and performance.');
    }
    
    if (alerts.length === 0) {
      alerts.push('OK: Cache is performing optimally.');
    }
    
    return alerts;
  }

  /**
   * Analyze performance level based on metrics
   */
  private getPerformanceLevel(
    metrics: any, 
    successRate: number, 
    conflictRate: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    if (successRate >= 99 && conflictRate <= 1 && metrics.averageLockWaitTime <= 100) {
      return 'excellent';
    } else if (successRate >= 95 && conflictRate <= 5 && metrics.averageLockWaitTime <= 500) {
      return 'good';
    } else if (successRate >= 90 && conflictRate <= 10 && metrics.averageLockWaitTime <= 1000) {
      return 'fair';
    } else {
      return 'poor';
    }
  }
}