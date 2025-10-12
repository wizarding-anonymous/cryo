import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

export interface ServiceStatus {
  name: string;
  url: string;
  isAvailable: boolean;
  lastChecked: Date;
  lastAvailable?: Date;
  lastUnavailable?: Date;
  responseTime?: number;
  errorMessage?: string;
  consecutiveFailures: number;
  totalChecks: number;
  totalFailures: number;
  uptimePercentage: number;
}

export interface ServiceAlert {
  serviceName: string;
  alertType: 'service_down' | 'service_recovered' | 'high_response_time' | 'degraded_performance';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Service availability monitor with alerting and graceful degradation
 * Task 17.3: Добавить мониторинг доступности внешних сервисов с алертами
 */
@Injectable()
export class ServiceAvailabilityMonitorService {
  private readonly logger = new Logger(ServiceAvailabilityMonitorService.name);
  private readonly services: Map<string, ServiceStatus> = new Map();
  private readonly alerts: ServiceAlert[] = [];
  private readonly maxAlerts = 1000;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly redisKeyPrefix = 'auth-service:service-monitor';
  
  // Configuration
  private readonly checkIntervalMs = 30000; // 30 seconds
  private readonly timeoutMs = 5000; // 5 seconds
  private readonly alertThreshold = 3; // Alert after 3 consecutive failures
  private readonly highResponseTimeThreshold = 2000; // 2 seconds

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.initializeServices();
    this.startMonitoring();
    this.loadStatusFromRedis();
    this.logger.log('Service Availability Monitor initialized with enhanced alerting');
  }

  /**
   * Initialize monitored services
   * Task 17.3: Инициализация мониторинга всех внешних сервисов
   */
  private initializeServices(): void {
    const services = [
      {
        name: 'UserService',
        url: this.configService.get<string>('USER_SERVICE_URL', 'http://localhost:3002'),
        healthPath: '/health',
      },
      {
        name: 'SecurityService',
        url: this.configService.get<string>('SECURITY_SERVICE_URL', 'http://localhost:3010'),
        healthPath: '/health',
      },
      {
        name: 'NotificationService',
        url: this.configService.get<string>('NOTIFICATION_SERVICE_URL', 'http://localhost:3007'),
        healthPath: '/health',
      },
    ];

    for (const service of services) {
      const status: ServiceStatus = {
        name: service.name,
        url: `${service.url}${service.healthPath}`,
        isAvailable: true, // Assume available initially
        lastChecked: new Date(),
        consecutiveFailures: 0,
        totalChecks: 0,
        totalFailures: 0,
        uptimePercentage: 100,
      };
      
      this.services.set(service.name, status);
    }

    this.logger.log(`Initialized monitoring for ${services.length} services`);
  }

  /**
   * Check health of a specific service
   * Task 17.3: Проверка здоровья конкретного сервиса
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceStatus | null> {
    const service = this.services.get(serviceName);
    if (!service) {
      this.logger.warn(`Service not found for health check: ${serviceName}`);
      return null;
    }

    const startTime = Date.now();
    let isAvailable = false;
    let errorMessage: string | undefined;
    let responseTime: number | undefined;

    try {
      const response = await firstValueFrom(
        this.httpService.get(service.url).pipe(
          timeout(this.timeoutMs),
          catchError(error => {
            throw error;
          })
        )
      );

      responseTime = Date.now() - startTime;
      isAvailable = response.status >= 200 && response.status < 300;
      
      if (!isAvailable) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      responseTime = Date.now() - startTime;
      isAvailable = false;
      errorMessage = error.message || 'Unknown error';
    }

    // Update service status
    const wasAvailable = service.isAvailable;
    service.isAvailable = isAvailable;
    service.lastChecked = new Date();
    service.responseTime = responseTime;
    service.errorMessage = errorMessage;
    service.totalChecks++;

    if (isAvailable) {
      service.lastAvailable = new Date();
      service.consecutiveFailures = 0;
      
      // Check for high response time
      if (responseTime && responseTime > this.highResponseTimeThreshold) {
        await this.createAlert(serviceName, 'high_response_time', 
          `High response time: ${responseTime}ms (threshold: ${this.highResponseTimeThreshold}ms)`, {
          responseTime,
          threshold: this.highResponseTimeThreshold,
        });
      }
      
      // Service recovered alert
      if (!wasAvailable) {
        await this.createAlert(serviceName, 'service_recovered', 
          `Service recovered after ${service.consecutiveFailures} consecutive failures`, {
          downtime: service.lastUnavailable ? Date.now() - service.lastUnavailable.getTime() : 0,
        });
      }
    } else {
      service.lastUnavailable = new Date();
      service.consecutiveFailures++;
      service.totalFailures++;
      
      // Service down alert (after threshold)
      if (wasAvailable || service.consecutiveFailures === this.alertThreshold) {
        await this.createAlert(serviceName, 'service_down', 
          `Service unavailable: ${errorMessage}`, {
          consecutiveFailures: service.consecutiveFailures,
          responseTime,
          error: errorMessage,
        });
      }
    }

    // Calculate uptime percentage
    service.uptimePercentage = service.totalChecks > 0 
      ? ((service.totalChecks - service.totalFailures) / service.totalChecks) * 100 
      : 100;

    // Store status in Redis
    await this.storeStatusInRedis(service);

    return service;
  }

  /**
   * Check health of all monitored services
   * Task 17.3: Проверка здоровья всех сервисов
   */
  async checkAllServices(): Promise<ServiceStatus[]> {
    const results: ServiceStatus[] = [];
    
    for (const serviceName of this.services.keys()) {
      try {
        const status = await this.checkServiceHealth(serviceName);
        if (status) {
          results.push(status);
        }
      } catch (error) {
        this.logger.error(`Failed to check health of ${serviceName}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get current status of a specific service
   * Task 17.3: Получение текущего статуса сервиса
   */
  getServiceStatus(serviceName: string): ServiceStatus | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Get status of all monitored services
   * Task 17.3: Получение статуса всех сервисов
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Check if a service is currently available
   * Task 17.3: Быстрая проверка доступности сервиса
   */
  isServiceAvailable(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service ? service.isAvailable : false;
  }

  /**
   * Get services that are currently unavailable
   * Task 17.3: Получение списка недоступных сервисов
   */
  getUnavailableServices(): ServiceStatus[] {
    return Array.from(this.services.values()).filter(service => !service.isAvailable);
  }

  /**
   * Get services with degraded performance (high response time)
   * Task 17.3: Получение сервисов с деградированной производительностью
   */
  getDegradedServices(): ServiceStatus[] {
    return Array.from(this.services.values()).filter(service => 
      service.isAvailable && 
      service.responseTime && 
      service.responseTime > this.highResponseTimeThreshold
    );
  }

  /**
   * Get recent alerts
   * Task 17.3: Получение недавних алертов
   */
  getRecentAlerts(limit: number = 50): ServiceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get alerts for a specific service
   * Task 17.3: Получение алертов для конкретного сервиса
   */
  getServiceAlerts(serviceName: string, limit: number = 20): ServiceAlert[] {
    return this.alerts
      .filter(alert => alert.serviceName === serviceName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get monitoring statistics
   * Task 17.3: Статистика мониторинга
   */
  getMonitoringStats(): {
    totalServices: number;
    availableServices: number;
    unavailableServices: number;
    degradedServices: number;
    averageUptime: number;
    averageResponseTime: number;
    totalAlerts: number;
    recentAlerts: number;
  } {
    const services = Array.from(this.services.values());
    const availableServices = services.filter(s => s.isAvailable).length;
    const degradedServices = this.getDegradedServices().length;
    
    const totalUptime = services.reduce((sum, s) => sum + s.uptimePercentage, 0);
    const averageUptime = services.length > 0 ? totalUptime / services.length : 100;
    
    const responseTimes = services
      .filter(s => s.responseTime !== undefined)
      .map(s => s.responseTime!);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;

    const recentAlerts = this.alerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      totalServices: services.length,
      availableServices,
      unavailableServices: services.length - availableServices,
      degradedServices,
      averageUptime: Math.round(averageUptime * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      totalAlerts: this.alerts.length,
      recentAlerts,
    };
  }

  /**
   * Force immediate health check for all services
   * Task 17.3: Принудительная проверка здоровья
   */
  async forceHealthCheck(): Promise<ServiceStatus[]> {
    this.logger.log('Forcing immediate health check for all services');
    return await this.checkAllServices();
  }

  /**
   * Reset statistics for a service
   * Task 17.3: Сброс статистики сервиса
   */
  async resetServiceStats(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) {
      return false;
    }

    service.consecutiveFailures = 0;
    service.totalChecks = 0;
    service.totalFailures = 0;
    service.uptimePercentage = 100;
    service.lastAvailable = undefined;
    service.lastUnavailable = undefined;
    service.responseTime = undefined;
    service.errorMessage = undefined;

    await this.storeStatusInRedis(service);
    this.logger.log(`Reset statistics for service: ${serviceName}`);
    
    return true;
  }

  /**
   * Clear all alerts
   * Task 17.3: Очистка всех алертов
   */
  clearAlerts(): void {
    const count = this.alerts.length;
    this.alerts.length = 0;
    this.logger.log(`Cleared ${count} alerts`);
  }

  /**
   * Create and store an alert
   * Task 17.3: Создание и сохранение алерта
   */
  private async createAlert(
    serviceName: string,
    alertType: ServiceAlert['alertType'],
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alert: ServiceAlert = {
      serviceName,
      alertType,
      message,
      timestamp: new Date(),
      metadata,
    };

    // Add to local alerts array
    if (this.alerts.length >= this.maxAlerts) {
      this.alerts.shift(); // Remove oldest alert
    }
    this.alerts.push(alert);

    // Store in Redis for persistence
    try {
      await this.storeAlertInRedis(alert);
    } catch (error) {
      this.logger.warn(`Failed to store alert in Redis: ${error.message}`);
    }

    // Log the alert
    const logLevel = alertType === 'service_down' ? 'error' : 
                    alertType === 'service_recovered' ? 'log' : 'warn';
    
    this.logger[logLevel](`Service Alert [${alertType}] ${serviceName}: ${message}`, metadata);
  }

  /**
   * Store service status in Redis
   * Task 17.3: Сохранение статуса в Redis
   */
  private async storeStatusInRedis(status: ServiceStatus): Promise<void> {
    try {
      const key = `${this.redisKeyPrefix}:status:${status.name}`;
      const value = JSON.stringify({
        ...status,
        lastChecked: status.lastChecked.toISOString(),
        lastAvailable: status.lastAvailable?.toISOString(),
        lastUnavailable: status.lastUnavailable?.toISOString(),
      });
      
      await this.redisService.set(key, value, 24 * 60 * 60); // 24 hours TTL
    } catch (error) {
      this.logger.warn(`Failed to store service status in Redis: ${error.message}`);
    }
  }

  /**
   * Store alert in Redis
   * Task 17.3: Сохранение алерта в Redis
   */
  private async storeAlertInRedis(alert: ServiceAlert): Promise<void> {
    try {
      const key = `${this.redisKeyPrefix}:alert:${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const value = JSON.stringify({
        ...alert,
        timestamp: alert.timestamp.toISOString(),
      });
      
      await this.redisService.set(key, value, 7 * 24 * 60 * 60); // 7 days TTL
    } catch (error) {
      this.logger.warn(`Failed to store alert in Redis: ${error.message}`);
    }
  }

  /**
   * Load service status from Redis on startup
   * Task 17.3: Загрузка статуса из Redis при запуске
   */
  private async loadStatusFromRedis(): Promise<void> {
    try {
      const pattern = `${this.redisKeyPrefix}:status:*`;
      const keys = await this.redisService.keys(pattern);
      
      for (const key of keys) {
        try {
          const value = await this.redisService.get(key);
          if (value) {
            const status = JSON.parse(value);
            // Convert date strings back to Date objects
            status.lastChecked = new Date(status.lastChecked);
            if (status.lastAvailable) status.lastAvailable = new Date(status.lastAvailable);
            if (status.lastUnavailable) status.lastUnavailable = new Date(status.lastUnavailable);
            
            this.services.set(status.name, status);
          }
        } catch (error) {
          this.logger.warn(`Failed to load service status from Redis key ${key}: ${error.message}`);
        }
      }

      // Load alerts
      const alertPattern = `${this.redisKeyPrefix}:alert:*`;
      const alertKeys = await this.redisService.keys(alertPattern);
      
      for (const key of alertKeys) {
        try {
          const value = await this.redisService.get(key);
          if (value) {
            const alert = JSON.parse(value);
            alert.timestamp = new Date(alert.timestamp);
            this.alerts.push(alert);
          }
        } catch (error) {
          this.logger.warn(`Failed to load alert from Redis key ${key}: ${error.message}`);
        }
      }

      // Sort alerts by timestamp
      this.alerts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      this.logger.log(`Loaded service monitoring data from Redis: ${keys.length} statuses, ${alertKeys.length} alerts`);
    } catch (error) {
      this.logger.error(`Failed to load monitoring data from Redis: ${error.message}`);
    }
  }

  /**
   * Start monitoring all services
   * Task 17.3: Запуск мониторинга всех сервисов
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        this.logger.error(`Monitoring cycle error: ${error.message}`);
      }
    }, this.checkIntervalMs);

    // Log statistics every 10 minutes
    setInterval(() => {
      const stats = this.getMonitoringStats();
      this.logger.log('Service monitoring statistics:', stats);
    }, 10 * 60 * 1000);

    this.logger.log(`Started service monitoring with ${this.checkIntervalMs}ms interval`);
  }

  /**
   * Cleanup resources
   */
  onModuleDestroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}