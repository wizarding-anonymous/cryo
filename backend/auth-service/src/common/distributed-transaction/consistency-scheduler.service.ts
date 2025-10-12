import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DistributedTransactionService } from './distributed-transaction.service';
import { ConsistencyMetricsService } from './consistency-metrics.service';

/**
 * Сервис для периодической проверки и восстановления консистентности
 * между Redis и PostgreSQL каждые 5 минут
 */
@Injectable()
export class ConsistencySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ConsistencySchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly distributedTransactionService: DistributedTransactionService,
    private readonly consistencyMetricsService: ConsistencyMetricsService,
  ) { }

  async onModuleInit() {
    this.logger.log('Consistency Scheduler Service initialized');

    // Запускаем первую проверку через 30 секунд после старта
    setTimeout(() => {
      this.runConsistencyCheck();
    }, 30000);
  }

  /**
   * Периодическая проверка консистентности каждые 5 минут
   * Cron: 0 star/5 * * * * (каждые 5 минут)
   */
  @Cron('0 */5 * * * *', {
    name: 'consistency-check',
    timeZone: 'UTC',
  })
  async scheduledConsistencyCheck(): Promise<void> {
    await this.runConsistencyCheck();
  }

  /**
   * Очистка зависших транзакций каждую минуту
   * Cron: 0 * * * * * (каждую минуту)
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'cleanup-stale-transactions',
    timeZone: 'UTC',
  })
  async scheduledTransactionCleanup(): Promise<void> {
    try {
      const cleanedUp = await this.distributedTransactionService.cleanupStaleTransactions();

      if (cleanedUp > 0) {
        this.logger.warn(`Cleaned up ${cleanedUp} stale transactions`);
      }
    } catch (error) {
      this.logger.error('Scheduled transaction cleanup failed', error.stack);
    }
  }

  /**
   * Очистка старых метрик каждый час
   * Cron: 0 0 * * * * (каждый час)
   */
  @Cron('0 0 * * * *', {
    name: 'cleanup-old-metrics',
    timeZone: 'UTC',
  })
  async scheduledMetricsCleanup(): Promise<void> {
    try {
      await this.consistencyMetricsService.cleanupOldMetrics();
      this.logger.debug('Old metrics cleaned up successfully');
    } catch (error) {
      this.logger.error('Scheduled metrics cleanup failed', error.stack);
    }
  }

  /**
   * Выполнить проверку консистентности
   */
  private async runConsistencyCheck(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Consistency check already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting scheduled consistency check');

      // Проверяем консистентность
      const result = await this.distributedTransactionService.checkConsistency();

      const duration = Date.now() - startTime;

      if (result.inconsistencies === 0) {
        this.logger.log(`Consistency check completed successfully in ${duration}ms. No inconsistencies found.`);
      } else {
        this.logger.warn(
          `Consistency check completed in ${duration}ms. Found ${result.inconsistencies} inconsistencies. ` +
          `Redis-only: ${result.redisOnly.length}, PostgreSQL-only: ${result.postgresOnly.length}, ` +
          `Repaired: ${result.repaired}, Errors: ${result.errors.length}`
        );

        // Если найдены критические несоответствия, запускаем автоматическое восстановление
        if (result.inconsistencies > 0) {
          await this.distributedTransactionService.autoRepairInconsistencies();
        }
      }

      // Логируем статистику активных транзакций
      const transactionStats = this.distributedTransactionService.getActiveTransactionsStats();
      if (transactionStats.total > 0) {
        this.logger.log(
          `Active transactions: ${transactionStats.total}, ` +
          `Status breakdown: ${JSON.stringify(transactionStats.byStatus)}`
        );
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Consistency check failed after ${duration}ms`, error.stack);

      // Отправляем алерт о критической ошибке
      try {
        // Здесь можно добавить отправку алерта в Slack/email
        this.logger.error('CRITICAL: Consistency check system failure - manual investigation required');
      } catch (alertError) {
        this.logger.error('Failed to send consistency check failure alert', alertError.stack);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ручной запуск проверки консистентности (для админских целей)
   */
  async manualConsistencyCheck(): Promise<void> {
    this.logger.log('Manual consistency check requested');
    await this.runConsistencyCheck();
  }

  /**
   * Получить статус планировщика
   */
  getSchedulerStatus(): {
    isRunning: boolean;
    activeTransactions: number;
    lastCheckTime?: Date;
  } {
    const transactionStats = this.distributedTransactionService.getActiveTransactionsStats();

    return {
      isRunning: this.isRunning,
      activeTransactions: transactionStats.total,
      lastCheckTime: transactionStats.oldestTransaction
    };
  }
}