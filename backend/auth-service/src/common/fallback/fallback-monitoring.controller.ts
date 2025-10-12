import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { LocalSecurityLoggerService } from './local-security-logger.service';
import { LocalNotificationQueueService } from './local-notification-queue.service';
import { ServiceAvailabilityMonitorService } from './service-availability-monitor.service';

/**
 * Controller for monitoring fallback services and graceful degradation
 * Task 17.3: Мониторинг fallback сервисов и graceful degradation
 */
@ApiTags('Fallback Monitoring')
@Controller('fallback')
export class FallbackMonitoringController {
  constructor(
    private readonly localSecurityLogger: LocalSecurityLoggerService,
    private readonly localNotificationQueue: LocalNotificationQueueService,
    private readonly serviceMonitor: ServiceAvailabilityMonitorService,
  ) {}

  /**
   * Get service availability status
   * Task 17.3: Мониторинг доступности внешних сервисов
   */
  @Get('services/status')
  @ApiOperation({ summary: 'Get status of all monitored external services' })
  @ApiResponse({ status: 200, description: 'Service status information' })
  getServiceStatus() {
    return {
      services: this.serviceMonitor.getAllServiceStatuses(),
      unavailableServices: this.serviceMonitor.getUnavailableServices(),
      degradedServices: this.serviceMonitor.getDegradedServices(),
      statistics: this.serviceMonitor.getMonitoringStats(),
    };
  }

  /**
   * Get status of a specific service
   * Task 17.3: Статус конкретного сервиса
   */
  @Get('services/:serviceName/status')
  @ApiOperation({ summary: 'Get status of a specific service' })
  @ApiParam({ name: 'serviceName', description: 'Name of the service to check' })
  @ApiResponse({ status: 200, description: 'Service status information' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  getSpecificServiceStatus(@Param('serviceName') serviceName: string) {
    const status = this.serviceMonitor.getServiceStatus(serviceName);
    if (!status) {
      return { error: 'Service not found', serviceName };
    }
    
    return {
      service: status,
      isAvailable: this.serviceMonitor.isServiceAvailable(serviceName),
      alerts: this.serviceMonitor.getServiceAlerts(serviceName, 10),
    };
  }

  /**
   * Force health check for all services
   * Task 17.3: Принудительная проверка здоровья сервисов
   */
  @Post('services/health-check')
  @ApiOperation({ summary: 'Force immediate health check for all services' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  async forceHealthCheck() {
    const results = await this.serviceMonitor.forceHealthCheck();
    return {
      timestamp: new Date(),
      results,
      summary: this.serviceMonitor.getMonitoringStats(),
    };
  }

  /**
   * Get recent service alerts
   * Task 17.3: Получение недавних алертов сервисов
   */
  @Get('services/alerts')
  @ApiOperation({ summary: 'Get recent service alerts' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of alerts to return' })
  @ApiResponse({ status: 200, description: 'Recent service alerts' })
  getServiceAlerts(@Query('limit') limit?: string) {
    const alertLimit = limit ? parseInt(limit, 10) : 50;
    return {
      alerts: this.serviceMonitor.getRecentAlerts(alertLimit),
      statistics: this.serviceMonitor.getMonitoringStats(),
    };
  }

  /**
   * Get local security statistics
   * Task 17.3: Статистика локального логирования безопасности
   */
  @Get('security/stats')
  @ApiOperation({ summary: 'Get local security logging statistics' })
  @ApiQuery({ name: 'hours', required: false, description: 'Time window in hours (default: 24)' })
  @ApiResponse({ status: 200, description: 'Local security statistics' })
  async getSecurityStats(@Query('hours') hours?: string) {
    const timeWindow = hours ? parseInt(hours, 10) : 24;
    const stats = await this.localSecurityLogger.getLocalSecurityStats(timeWindow);
    const queueStats = this.localSecurityLogger.getQueueStats();
    
    return {
      timeWindow: `${timeWindow} hours`,
      statistics: stats,
      queue: queueStats,
      timestamp: new Date(),
    };
  }

  /**
   * Get local security events for a user
   * Task 17.3: Локальные события безопасности пользователя
   */
  @Get('security/events/:userId')
  @ApiOperation({ summary: 'Get local security events for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID to get events for' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of events to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of events to skip' })
  @ApiResponse({ status: 200, description: 'User security events' })
  async getUserSecurityEvents(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const eventLimit = limit ? parseInt(limit, 10) : 50;
    const eventOffset = offset ? parseInt(offset, 10) : 0;
    
    const events = await this.localSecurityLogger.getLocalEventsForUser(userId, eventLimit, eventOffset);
    
    return {
      userId,
      events,
      pagination: {
        limit: eventLimit,
        offset: eventOffset,
        count: events.length,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get notification queue statistics
   * Task 17.3: Статистика очереди уведомлений
   */
  @Get('notifications/queue/stats')
  @ApiOperation({ summary: 'Get notification queue statistics' })
  @ApiResponse({ status: 200, description: 'Notification queue statistics' })
  getNotificationQueueStats() {
    const stats = this.localNotificationQueue.getQueueStats();
    
    return {
      queue: stats,
      timestamp: new Date(),
    };
  }

  /**
   * Get notifications ready for retry
   * Task 17.3: Уведомления готовые для повторной отправки
   */
  @Get('notifications/queue/ready')
  @ApiOperation({ summary: 'Get notifications ready for retry' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of notifications to return' })
  @ApiResponse({ status: 200, description: 'Notifications ready for retry' })
  getNotificationsReadyForRetry(@Query('limit') limit?: string) {
    const notificationLimit = limit ? parseInt(limit, 10) : 20;
    const notifications = this.localNotificationQueue.getNotificationsReadyForRetry(notificationLimit);
    
    return {
      notifications,
      count: notifications.length,
      timestamp: new Date(),
    };
  }

  /**
   * Get notifications by priority
   * Task 17.3: Уведомления по приоритету
   */
  @Get('notifications/queue/priority/:priority')
  @ApiOperation({ summary: 'Get queued notifications by priority' })
  @ApiParam({ name: 'priority', enum: ['high', 'normal', 'low'], description: 'Notification priority' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of notifications to return' })
  @ApiResponse({ status: 200, description: 'Queued notifications by priority' })
  getNotificationsByPriority(
    @Param('priority') priority: 'high' | 'normal' | 'low',
    @Query('limit') limit?: string
  ) {
    const notificationLimit = limit ? parseInt(limit, 10) : 50;
    const notifications = this.localNotificationQueue.getQueuedNotificationsByPriority(priority, notificationLimit);
    
    return {
      priority,
      notifications,
      count: notifications.length,
      timestamp: new Date(),
    };
  }

  /**
   * Clean up old notifications
   * Task 17.3: Очистка старых уведомлений
   */
  @Post('notifications/queue/cleanup')
  @ApiOperation({ summary: 'Clean up old notifications from queue' })
  @ApiQuery({ name: 'maxAgeHours', required: false, description: 'Maximum age in hours (default: 72)' })
  @ApiResponse({ status: 200, description: 'Cleanup results' })
  async cleanupOldNotifications(@Query('maxAgeHours') maxAgeHours?: string) {
    const maxAge = maxAgeHours ? parseInt(maxAgeHours, 10) : 72;
    const cleaned = await this.localNotificationQueue.cleanupOldNotifications(maxAge);
    
    return {
      cleaned,
      maxAgeHours: maxAge,
      timestamp: new Date(),
    };
  }

  /**
   * Get comprehensive fallback system health
   * Task 17.3: Общее состояние системы fallback
   */
  @Get('health')
  @ApiOperation({ summary: 'Get comprehensive fallback system health' })
  @ApiResponse({ status: 200, description: 'Fallback system health information' })
  async getFallbackSystemHealth() {
    const serviceStats = this.serviceMonitor.getMonitoringStats();
    const securityStats = await this.localSecurityLogger.getLocalSecurityStats(24);
    const notificationStats = this.localNotificationQueue.getQueueStats();
    
    const isHealthy = 
      serviceStats.availableServices >= serviceStats.totalServices * 0.5 && // At least 50% services available
      securityStats.unprocessedEvents < 1000 && // Not too many unprocessed security events
      notificationStats.totalQueued < 5000; // Not too many queued notifications

    return {
      isHealthy,
      services: {
        total: serviceStats.totalServices,
        available: serviceStats.availableServices,
        unavailable: serviceStats.unavailableServices,
        degraded: serviceStats.degradedServices,
        averageUptime: serviceStats.averageUptime,
      },
      security: {
        totalEvents24h: securityStats.totalEvents,
        unprocessedEvents: securityStats.unprocessedEvents,
        suspiciousActivities: securityStats.suspiciousActivities,
      },
      notifications: {
        totalQueued: notificationStats.totalQueued,
        readyForRetry: notificationStats.readyForRetry,
        byPriority: notificationStats.byPriority,
      },
      recommendations: this.getHealthRecommendations(serviceStats, securityStats, notificationStats),
      timestamp: new Date(),
    };
  }

  /**
   * Get health recommendations based on current state
   * Task 17.3: Рекомендации по улучшению здоровья системы
   */
  private getHealthRecommendations(serviceStats: any, securityStats: any, notificationStats: any): string[] {
    const recommendations: string[] = [];

    if (serviceStats.unavailableServices > 0) {
      recommendations.push(`${serviceStats.unavailableServices} service(s) are unavailable - check service health`);
    }

    if (serviceStats.degradedServices > 0) {
      recommendations.push(`${serviceStats.degradedServices} service(s) have degraded performance - investigate response times`);
    }

    if (serviceStats.averageUptime < 95) {
      recommendations.push(`Average uptime is ${serviceStats.averageUptime}% - consider improving service reliability`);
    }

    if (securityStats.unprocessedEvents > 500) {
      recommendations.push(`${securityStats.unprocessedEvents} unprocessed security events - Security Service may need attention`);
    }

    if (notificationStats.totalQueued > 1000) {
      recommendations.push(`${notificationStats.totalQueued} queued notifications - Notification Service may need attention`);
    }

    if (notificationStats.readyForRetry > 100) {
      recommendations.push(`${notificationStats.readyForRetry} notifications ready for retry - consider processing queue`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All fallback systems are operating normally');
    }

    return recommendations;
  }
}