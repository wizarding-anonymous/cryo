import { Controller, Get, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SagaService, SagaTransaction, SagaMetrics } from './saga.service';

@ApiTags('Saga Management')
@Controller('saga')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SagaController {
  constructor(private readonly sagaService: SagaService) {}

  @Get('metrics')
  @ApiOperation({ 
    summary: 'Get saga execution metrics',
    description: 'Returns comprehensive metrics about saga transaction execution including success rates, performance data, and failure statistics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Saga metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalTransactions: { type: 'number', description: 'Total number of saga transactions' },
        completedTransactions: { type: 'number', description: 'Number of successfully completed transactions' },
        failedTransactions: { type: 'number', description: 'Number of failed transactions' },
        compensatedTransactions: { type: 'number', description: 'Number of compensated transactions' },
        averageExecutionTime: { type: 'number', description: 'Average execution time in milliseconds' },
        successRate: { type: 'number', description: 'Success rate as percentage' },
      }
    }
  })
  async getMetrics(): Promise<SagaMetrics> {
    return this.sagaService.getMetrics();
  }

  @Get(':sagaId')
  @ApiOperation({ 
    summary: 'Get saga transaction details',
    description: 'Retrieves detailed information about a specific saga transaction including status, steps, and execution history'
  })
  @ApiParam({ name: 'sagaId', description: 'Unique identifier of the saga transaction' })
  @ApiResponse({ 
    status: 200, 
    description: 'Saga transaction details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Saga transaction ID' },
        name: { type: 'string', description: 'Saga transaction name' },
        status: { 
          type: 'string', 
          enum: ['pending', 'running', 'completed', 'failed', 'compensating', 'compensated'],
          description: 'Current status of the saga transaction'
        },
        currentStepIndex: { type: 'number', description: 'Index of currently executing step' },
        executedSteps: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of successfully executed step IDs'
        },
        compensatedSteps: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of compensated step IDs'
        },
        startedAt: { type: 'string', format: 'date-time', description: 'Saga start timestamp' },
        completedAt: { type: 'string', format: 'date-time', description: 'Saga completion timestamp' },
        error: { type: 'string', description: 'Error message if saga failed' },
        metadata: { type: 'object', description: 'Additional saga metadata' },
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Saga transaction not found' })
  async getSaga(@Param('sagaId') sagaId: string): Promise<SagaTransaction | null> {
    return this.sagaService.getSaga(sagaId);
  }

  @Delete('cleanup')
  @ApiOperation({ 
    summary: 'Clean up old saga transactions',
    description: 'Removes saga transactions older than specified hours to free up storage space'
  })
  @ApiQuery({ 
    name: 'olderThanHours', 
    required: false, 
    type: 'number', 
    description: 'Remove sagas older than this many hours (default: 24)' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cleanup completed successfully',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number', description: 'Number of saga transactions deleted' },
        olderThanHours: { type: 'number', description: 'Cleanup threshold in hours' },
      }
    }
  })
  async cleanup(@Query('olderThanHours') olderThanHours?: number): Promise<{ deletedCount: number; olderThanHours: number }> {
    const hours = olderThanHours || 24;
    const deletedCount = await this.sagaService.cleanup(hours);
    
    return {
      deletedCount,
      olderThanHours: hours,
    };
  }

  @Get('health/status')
  @ApiOperation({ 
    summary: 'Get saga service health status',
    description: 'Returns health information about the saga service including Redis connectivity and performance metrics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Saga service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        metrics: {
          type: 'object',
          properties: {
            totalTransactions: { type: 'number' },
            recentSuccessRate: { type: 'number' },
            averageExecutionTime: { type: 'number' },
          }
        },
        timestamp: { type: 'string', format: 'date-time' },
      }
    }
  })
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Partial<SagaMetrics>;
    timestamp: Date;
  }> {
    try {
      const metrics = await this.sagaService.getMetrics();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Determine health status based on metrics
      if (metrics.successRate < 50) {
        status = 'unhealthy';
      } else if (metrics.successRate < 80 || metrics.averageExecutionTime > 30000) {
        status = 'degraded';
      }

      return {
        status,
        metrics: {
          totalTransactions: metrics.totalTransactions,
          successRate: metrics.successRate,
          averageExecutionTime: metrics.averageExecutionTime,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: {},
        timestamp: new Date(),
      };
    }
  }
}