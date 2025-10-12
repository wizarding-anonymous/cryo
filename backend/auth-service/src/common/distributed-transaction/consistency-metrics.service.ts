import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface ConsistencyMetrics {
  timestamp: string;
  totalChecked: number;
  inconsistencies: number;
  redisOnly: number;
  postgresOnly: number;
  repaired: number;
  errors: number;
  consistencyRatio: number;
  raceConditionConflicts?: number;
  atomicOperationSuccessRate?: number;
  tokenConsistencyRatio?: number;
}

export interface MetricsSnapshot {
  current: ConsistencyMetrics;
  previous?: ConsistencyMetrics;
  trend: 'improving' | 'degrading' | 'stable';
  alerts: string[];
}

/**
 * Сервис для сбора и отправки метрик консистентности между хранилищами
 * Интегрируется с Prometheus для мониторинга
 */
@Injectable()
export class ConsistencyMetricsService {
  private readonly logger = new Logger(ConsistencyMetricsService.name);
  private readonly metricsPrefix = 'auth_service:metrics';
  
  constructor(private readonly redisService: RedisService) {}

  /**
   * Сохранить метрики консистентности
   */
  async recordConsistencyMetrics(metrics: Partial<ConsistencyMetrics>): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const fullMetrics: ConsistencyMetrics = {
        timestamp,
        totalChecked: 0,
        inconsistencies: 0,
        redisOnly: 0,
        postgresOnly: 0,
        repaired: 0,
        errors: 0,
        consistencyRatio: 1,
        ...metrics
      };

      // Сохраняем текущие метрики
      const currentKey = `${this.metricsPrefix}:consistency:current`;
      await this.redisService.set(currentKey, JSON.stringify(fullMetrics), 3600); // TTL 1 hour

      // Сохраняем в историю (последние 24 записи = 2 часа при проверке каждые 5 минут)
      const historyKey = `${this.metricsPrefix}:consistency:history`;
      await this.addToHistory(historyKey, fullMetrics, 24);

      // Обновляем агрегированные метрики
      await this.updateAggregatedMetrics(fullMetrics);

      // Проверяем пороговые значения и создаем алерты
      await this.checkThresholds(fullMetrics);

      this.logger.debug(`Consistency metrics recorded: ${JSON.stringify(fullMetrics)}`);
    } catch (error) {
      this.logger.error('Failed to record consistency metrics', error.stack);
    }
  }

  /**
   * Записать метрики race condition конфликтов
   */
  async recordRaceConditionMetrics(conflicts: number, totalAttempts: number): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const conflictRate = totalAttempts > 0 ? conflicts / totalAttempts : 0;

      const metrics = {
        timestamp,
        raceConditionConflicts: conflicts,
        totalSessionCreationAttempts: totalAttempts,
        conflictRate,
        type: 'race_condition'
      };

      const key = `${this.metricsPrefix}:race_conditions:current`;
      await this.redisService.set(key, JSON.stringify(metrics), 3600);

      // Добавляем в историю
      const historyKey = `${this.metricsPrefix}:race_conditions:history`;
      await this.addToHistory(historyKey, metrics, 48); // 4 часа истории

      // Алерт при высоком уровне конфликтов
      if (conflictRate > 0.1) { // Более 10% конфликтов
        await this.createAlert('high_race_condition_rate', {
          conflictRate: (conflictRate * 100).toFixed(2) + '%',
          conflicts,
          totalAttempts,
          severity: conflictRate > 0.2 ? 'critical' : 'warning'
        });
      }

      this.logger.debug(`Race condition metrics recorded: conflicts=${conflicts}, rate=${(conflictRate * 100).toFixed(2)}%`);
    } catch (error) {
      this.logger.error('Failed to record race condition metrics', error.stack);
    }
  }

  /**
   * Записать метрики успешности атомарных операций
   */
  async recordAtomicOperationMetrics(
    operation: 'logout' | 'token_rotation' | 'bulk_invalidation',
    success: boolean,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const key = `${this.metricsPrefix}:atomic_operations:${operation}`;

      // Получаем текущую статистику
      const currentStats = await this.getOperationStats(operation);
      
      // Обновляем статистику
      const updatedStats = {
        ...currentStats,
        timestamp,
        totalOperations: currentStats.totalOperations + 1,
        successfulOperations: currentStats.successfulOperations + (success ? 1 : 0),
        failedOperations: currentStats.failedOperations + (success ? 0 : 1),
        totalDuration: currentStats.totalDuration + duration,
        lastOperation: {
          timestamp,
          success,
          duration,
          metadata
        }
      };

      updatedStats.successRate = updatedStats.totalOperations > 0 ? 
        updatedStats.successfulOperations / updatedStats.totalOperations : 0;
      updatedStats.averageDuration = updatedStats.totalOperations > 0 ? 
        updatedStats.totalDuration / updatedStats.totalOperations : 0;

      await this.redisService.set(key, JSON.stringify(updatedStats), 3600);

      // Алерт при низкой успешности
      if (updatedStats.totalOperations >= 10 && updatedStats.successRate < 0.9) {
        await this.createAlert('low_atomic_operation_success_rate', {
          operation,
          successRate: (updatedStats.successRate * 100).toFixed(2) + '%',
          totalOperations: updatedStats.totalOperations,
          failedOperations: updatedStats.failedOperations,
          severity: updatedStats.successRate < 0.8 ? 'critical' : 'warning'
        });
      }

      this.logger.debug(`Atomic operation metrics recorded: ${operation}, success=${success}, duration=${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to record atomic operation metrics', error.stack);
    }
  }

  /**
   * Получить снимок текущих метрик с трендами
   */
  async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    try {
      // Получаем текущие метрики
      const currentKey = `${this.metricsPrefix}:consistency:current`;
      const currentData = await this.redisService.get(currentKey);
      const current = currentData ? JSON.parse(currentData) : null;

      if (!current) {
        return {
          current: this.getDefaultMetrics(),
          trend: 'stable',
          alerts: []
        };
      }

      // Получаем предыдущие метрики для сравнения
      const historyKey = `${this.metricsPrefix}:consistency:history`;
      const historyData = await this.redisService.get(historyKey);
      const history = historyData ? JSON.parse(historyData) : [];
      const previous = history.length > 1 ? history[history.length - 2] : null;

      // Определяем тренд
      const trend = this.calculateTrend(current, previous);

      // Получаем активные алерты
      const alerts = await this.getActiveAlerts();

      return {
        current,
        previous,
        trend,
        alerts
      };
    } catch (error) {
      this.logger.error('Failed to get metrics snapshot', error.stack);
      return {
        current: this.getDefaultMetrics(),
        trend: 'stable',
        alerts: ['Failed to retrieve metrics']
      };
    }
  }

  /**
   * Получить метрики для Prometheus
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      const snapshot = await this.getMetricsSnapshot();
      const current = snapshot.current;

      const metrics = [
        `# HELP auth_service_consistency_ratio Ratio of consistent tokens between Redis and PostgreSQL`,
        `# TYPE auth_service_consistency_ratio gauge`,
        `auth_service_consistency_ratio ${current.consistencyRatio}`,
        '',
        `# HELP auth_service_inconsistencies_total Total number of inconsistencies found`,
        `# TYPE auth_service_inconsistencies_total counter`,
        `auth_service_inconsistencies_total ${current.inconsistencies}`,
        '',
        `# HELP auth_service_tokens_checked_total Total number of tokens checked`,
        `# TYPE auth_service_tokens_checked_total counter`,
        `auth_service_tokens_checked_total ${current.totalChecked}`,
        '',
        `# HELP auth_service_redis_only_tokens Number of tokens found only in Redis`,
        `# TYPE auth_service_redis_only_tokens gauge`,
        `auth_service_redis_only_tokens ${current.redisOnly}`,
        '',
        `# HELP auth_service_postgres_only_tokens Number of tokens found only in PostgreSQL`,
        `# TYPE auth_service_postgres_only_tokens gauge`,
        `auth_service_postgres_only_tokens ${current.postgresOnly}`,
        '',
        `# HELP auth_service_repaired_inconsistencies_total Number of automatically repaired inconsistencies`,
        `# TYPE auth_service_repaired_inconsistencies_total counter`,
        `auth_service_repaired_inconsistencies_total ${current.repaired}`,
        ''
      ];

      // Добавляем метрики race condition если есть
      if (current.raceConditionConflicts !== undefined) {
        metrics.push(
          `# HELP auth_service_race_condition_conflicts_total Number of race condition conflicts`,
          `# TYPE auth_service_race_condition_conflicts_total counter`,
          `auth_service_race_condition_conflicts_total ${current.raceConditionConflicts}`,
          ''
        );
      }

      // Добавляем метрики атомарных операций
      if (current.atomicOperationSuccessRate !== undefined) {
        metrics.push(
          `# HELP auth_service_atomic_operation_success_rate Success rate of atomic operations`,
          `# TYPE auth_service_atomic_operation_success_rate gauge`,
          `auth_service_atomic_operation_success_rate ${current.atomicOperationSuccessRate}`,
          ''
        );
      }

      return metrics.join('\n');
    } catch (error) {
      this.logger.error('Failed to generate Prometheus metrics', error.stack);
      return '# Error generating metrics\n';
    }
  }

  /**
   * Очистить старые метрики
   */
  async cleanupOldMetrics(): Promise<void> {
    try {
      const patterns = [
        `${this.metricsPrefix}:consistency:history`,
        `${this.metricsPrefix}:race_conditions:history`,
        `${this.metricsPrefix}:alerts:*`
      ];

      for (const pattern of patterns) {
        const keys = await this.redisService.keys(pattern);
        for (const key of keys) {
          // Проверяем возраст ключа
          const ttl = await this.redisService.getTTL(key);
          if (ttl === -1) { // Ключ без TTL
            await this.redisService.delete(key);
          }
        }
      }

      this.logger.debug('Old metrics cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics', error.stack);
    }
  }

  /**
   * Добавить запись в историю с ограничением размера
   */
  private async addToHistory(key: string, data: any, maxSize: number): Promise<void> {
    try {
      const historyData = await this.redisService.get(key);
      const history = historyData ? JSON.parse(historyData) : [];
      
      history.push(data);
      
      // Ограничиваем размер истории
      if (history.length > maxSize) {
        history.splice(0, history.length - maxSize);
      }
      
      await this.redisService.set(key, JSON.stringify(history), 7200); // TTL 2 hours
    } catch (error) {
      this.logger.error(`Failed to add to history: ${key}`, error.stack);
    }
  }

  /**
   * Обновить агрегированные метрики
   */
  private async updateAggregatedMetrics(metrics: ConsistencyMetrics): Promise<void> {
    try {
      const aggregatedKey = `${this.metricsPrefix}:aggregated`;
      const existingData = await this.redisService.get(aggregatedKey);
      const existing = existingData ? JSON.parse(existingData) : {
        totalChecks: 0,
        totalInconsistencies: 0,
        totalRepaired: 0,
        averageConsistencyRatio: 0,
        lastUpdated: null
      };

      const updated = {
        totalChecks: existing.totalChecks + 1,
        totalInconsistencies: existing.totalInconsistencies + metrics.inconsistencies,
        totalRepaired: existing.totalRepaired + metrics.repaired,
        averageConsistencyRatio: ((existing.averageConsistencyRatio * existing.totalChecks) + metrics.consistencyRatio) / (existing.totalChecks + 1),
        lastUpdated: metrics.timestamp
      };

      await this.redisService.set(aggregatedKey, JSON.stringify(updated), 86400); // TTL 24 hours
    } catch (error) {
      this.logger.error('Failed to update aggregated metrics', error.stack);
    }
  }

  /**
   * Проверить пороговые значения и создать алерты
   */
  private async checkThresholds(metrics: ConsistencyMetrics): Promise<void> {
    const alerts: Array<{type: string, data: any}> = [];

    // Критический уровень несоответствий
    if (metrics.inconsistencies > 100) {
      alerts.push({
        type: 'critical_inconsistency_level',
        data: {
          inconsistencies: metrics.inconsistencies,
          consistencyRatio: (metrics.consistencyRatio * 100).toFixed(2) + '%',
          severity: 'critical'
        }
      });
    }

    // Низкий коэффициент консистентности
    if (metrics.consistencyRatio < 0.95) {
      alerts.push({
        type: 'low_consistency_ratio',
        data: {
          consistencyRatio: (metrics.consistencyRatio * 100).toFixed(2) + '%',
          inconsistencies: metrics.inconsistencies,
          severity: metrics.consistencyRatio < 0.9 ? 'critical' : 'warning'
        }
      });
    }

    // Высокий уровень ошибок
    if (metrics.errors > 10) {
      alerts.push({
        type: 'high_error_rate',
        data: {
          errors: metrics.errors,
          severity: 'warning'
        }
      });
    }

    // Создаем алерты
    for (const alert of alerts) {
      await this.createAlert(alert.type, alert.data);
    }
  }

  /**
   * Создать алерт
   */
  private async createAlert(type: string, data: any): Promise<void> {
    try {
      const alertKey = `${this.metricsPrefix}:alerts:${type}:${Date.now()}`;
      const alert = {
        type,
        timestamp: new Date().toISOString(),
        data,
        acknowledged: false
      };

      await this.redisService.set(alertKey, JSON.stringify(alert), 3600); // TTL 1 hour
      
      this.logger.warn(`Alert created: ${type}`, data);
    } catch (error) {
      this.logger.error(`Failed to create alert: ${type}`, error.stack);
    }
  }

  /**
   * Получить активные алерты
   */
  private async getActiveAlerts(): Promise<string[]> {
    try {
      const alertKeys = await this.redisService.keys(`${this.metricsPrefix}:alerts:*`);
      const alerts: string[] = [];

      for (const key of alertKeys) {
        const alertData = await this.redisService.get(key);
        if (alertData) {
          const alert = JSON.parse(alertData);
          if (!alert.acknowledged) {
            alerts.push(`${alert.type}: ${JSON.stringify(alert.data)}`);
          }
        }
      }

      return alerts;
    } catch (error) {
      this.logger.error('Failed to get active alerts', error.stack);
      return [];
    }
  }

  /**
   * Получить статистику операций
   */
  private async getOperationStats(operation: string): Promise<any> {
    try {
      const key = `${this.metricsPrefix}:atomic_operations:${operation}`;
      const data = await this.redisService.get(key);
      
      if (data) {
        return JSON.parse(data);
      }

      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0
      };
    } catch (error) {
      this.logger.error(`Failed to get operation stats for ${operation}`, error.stack);
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0
      };
    }
  }

  /**
   * Вычислить тренд изменения метрик
   */
  private calculateTrend(current: ConsistencyMetrics, previous?: ConsistencyMetrics): 'improving' | 'degrading' | 'stable' {
    if (!previous) return 'stable';

    const currentRatio = current.consistencyRatio;
    const previousRatio = previous.consistencyRatio;
    const threshold = 0.01; // 1% изменение

    if (currentRatio > previousRatio + threshold) {
      return 'improving';
    } else if (currentRatio < previousRatio - threshold) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }

  /**
   * Получить метрики по умолчанию
   */
  private getDefaultMetrics(): ConsistencyMetrics {
    return {
      timestamp: new Date().toISOString(),
      totalChecked: 0,
      inconsistencies: 0,
      redisOnly: 0,
      postgresOnly: 0,
      repaired: 0,
      errors: 0,
      consistencyRatio: 1
    };
  }
}