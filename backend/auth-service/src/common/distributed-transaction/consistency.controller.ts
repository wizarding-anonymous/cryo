import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DistributedTransactionService } from './distributed-transaction.service';
import { ConsistencySchedulerService } from './consistency-scheduler.service';
import { ConsistencyMetricsService } from './consistency-metrics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Контроллер для админских операций проверки и восстановления консистентности
 * Предоставляет API для мониторинга и управления консистентностью данных
 */
@ApiTags('Admin - Consistency Management')
@Controller('admin/consistency')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConsistencyController {
  constructor(
    private readonly distributedTransactionService: DistributedTransactionService,
    private readonly consistencySchedulerService: ConsistencySchedulerService,
    private readonly consistencyMetricsService: ConsistencyMetricsService,
  ) {}

  /**
   * Выполнить проверку консистентности между Redis и PostgreSQL
   */
  @Get('check')
  @ApiOperation({ 
    summary: 'Check consistency between Redis and PostgreSQL',
    description: 'Performs a comprehensive check of token consistency between Redis and PostgreSQL storage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Consistency check completed',
    schema: {
      type: 'object',
      properties: {
        totalChecked: { type: 'number' },
        inconsistencies: { type: 'number' },
        redisOnly: { type: 'array', items: { type: 'string' } },
        postgresOnly: { type: 'array', items: { type: 'string' } },
        repaired: { type: 'number' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async checkConsistency() {
    return await this.distributedTransactionService.checkConsistency();
  }

  /**
   * Выполнить автоматическое восстановление консистентности
   */
  @Post('repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Automatically repair consistency issues',
    description: 'Performs automatic repair of detected inconsistencies between Redis and PostgreSQL'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Consistency repair completed'
  })
  async repairConsistency() {
    await this.distributedTransactionService.autoRepairInconsistencies();
    return { message: 'Consistency repair completed' };
  }

  /**
   * Запустить ручную проверку консистентности
   */
  @Post('manual-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Trigger manual consistency check',
    description: 'Manually triggers a consistency check outside of the scheduled interval'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Manual consistency check triggered'
  })
  async triggerManualCheck() {
    await this.consistencySchedulerService.manualConsistencyCheck();
    return { message: 'Manual consistency check completed' };
  }

  /**
   * Получить статистику активных транзакций
   */
  @Get('transactions')
  @ApiOperation({ 
    summary: 'Get active transactions statistics',
    description: 'Returns information about currently active distributed transactions'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Active transactions statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        byStatus: { type: 'object' },
        oldestTransaction: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getActiveTransactions() {
    return this.distributedTransactionService.getActiveTransactionsStats();
  }

  /**
   * Очистить зависшие транзакции
   */
  @Post('cleanup-transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cleanup stale transactions',
    description: 'Manually cleanup transactions that have exceeded their timeout'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Stale transactions cleaned up',
    schema: {
      type: 'object',
      properties: {
        cleanedUp: { type: 'number' }
      }
    }
  })
  async cleanupStaleTransactions() {
    const cleanedUp = await this.distributedTransactionService.cleanupStaleTransactions();
    return { cleanedUp };
  }

  /**
   * Получить снимок метрик консистентности
   */
  @Get('metrics')
  @ApiOperation({ 
    summary: 'Get consistency metrics snapshot',
    description: 'Returns current consistency metrics with trends and alerts'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Consistency metrics snapshot',
    schema: {
      type: 'object',
      properties: {
        current: { type: 'object' },
        previous: { type: 'object' },
        trend: { type: 'string', enum: ['improving', 'degrading', 'stable'] },
        alerts: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async getMetricsSnapshot() {
    return await this.consistencyMetricsService.getMetricsSnapshot();
  }

  /**
   * Получить метрики в формате Prometheus
   */
  @Get('metrics/prometheus')
  @ApiOperation({ 
    summary: 'Get Prometheus metrics',
    description: 'Returns consistency metrics in Prometheus format for monitoring'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Prometheus metrics',
    content: {
      'text/plain': {
        schema: { type: 'string' }
      }
    }
  })
  async getPrometheusMetrics() {
    const metrics = await this.consistencyMetricsService.getPrometheusMetrics();
    return metrics;
  }

  /**
   * Получить статус планировщика консистентности
   */
  @Get('scheduler/status')
  @ApiOperation({ 
    summary: 'Get consistency scheduler status',
    description: 'Returns current status of the consistency check scheduler'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Scheduler status',
    schema: {
      type: 'object',
      properties: {
        isRunning: { type: 'boolean' },
        activeTransactions: { type: 'number' },
        lastCheckTime: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getSchedulerStatus() {
    return this.consistencySchedulerService.getSchedulerStatus();
  }

  /**
   * Очистить старые метрики
   */
  @Post('metrics/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Cleanup old metrics',
    description: 'Manually cleanup old consistency metrics from Redis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Old metrics cleaned up'
  })
  async cleanupOldMetrics() {
    await this.consistencyMetricsService.cleanupOldMetrics();
    return { message: 'Old metrics cleaned up' };
  }
}