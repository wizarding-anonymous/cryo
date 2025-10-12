import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AsyncOperationsService } from './async-operations.service';
import { AsyncMetricsService } from './async-metrics.service';
import { PriorityQueueService } from './priority-queue.service';
import { WorkerProcessService } from './worker-process.service';

@ApiTags('Async Operations Monitoring')
@Controller('async')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AsyncMonitoringController {
  constructor(
    private readonly asyncOperations: AsyncOperationsService,
    private readonly metricsService: AsyncMetricsService,
    private readonly priorityQueue: PriorityQueueService,
    private readonly workerProcess: WorkerProcessService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get async operations metrics' })
  @ApiResponse({ status: 200, description: 'Returns async operations metrics' })
  getMetrics() {
    return {
      operations: this.asyncOperations.getMetrics(),
      performance: this.metricsService.getAllAggregatedMetrics(),
      system: this.metricsService.getSystemMetrics(),
      queue: this.priorityQueue.getStatus(),
      workers: this.workerProcess.getWorkerMetrics(),
    };
  }

  @Get('performance-summary')
  @ApiOperation({ summary: 'Get performance summary for dashboard' })
  @ApiResponse({ status: 200, description: 'Returns performance summary' })
  getPerformanceSummary() {
    return this.metricsService.getPerformanceSummary();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get async operations health status' })
  @ApiResponse({ status: 200, description: 'Returns health status' })
  getHealthStatus() {
    return this.metricsService.getHealthStatus();
  }

  @Get('queue-status')
  @ApiOperation({ summary: 'Get priority queue status' })
  @ApiResponse({ status: 200, description: 'Returns queue status' })
  getQueueStatus() {
    return this.priorityQueue.getStatus();
  }

  @Post('clear-queues')
  @ApiOperation({ summary: 'Clear all priority queues (admin only)' })
  @ApiResponse({ status: 200, description: 'Queues cleared successfully' })
  clearQueues() {
    this.priorityQueue.clear();
    return { message: 'All queues cleared successfully' };
  }

  @Get('auth-flow-metrics')
  @ApiOperation({ summary: 'Get authentication flow specific metrics' })
  @ApiResponse({ status: 200, description: 'Returns auth flow metrics' })
  getAuthFlowMetrics() {
    const summary = this.metricsService.getPerformanceSummary();
    return {
      authFlow: summary.authFlow,
      criticalPathMetrics: {
        login: this.metricsService.getAggregatedMetrics('auth_login'),
        register: this.metricsService.getAggregatedMetrics('auth_register'),
        logout: this.metricsService.getAggregatedMetrics('auth_logout'),
        validate: this.metricsService.getAggregatedMetrics('auth_validate'),
        refresh: this.metricsService.getAggregatedMetrics('auth_refresh'),
      },
    };
  }

  @Get('event-processing-metrics')
  @ApiOperation({ summary: 'Get event processing metrics' })
  @ApiResponse({ status: 200, description: 'Returns event processing metrics' })
  getEventProcessingMetrics() {
    const summary = this.metricsService.getPerformanceSummary();
    return {
      eventProcessing: summary.eventProcessing,
      eventTypes: {
        security: this.metricsService.getAggregatedMetrics('event_security'),
        notification: this.metricsService.getAggregatedMetrics('event_notification'),
        user: this.metricsService.getAggregatedMetrics('event_user'),
      },
    };
  }

  @Get('external-services-metrics')
  @ApiOperation({ summary: 'Get external services metrics' })
  @ApiResponse({ status: 200, description: 'Returns external services metrics' })
  getExternalServicesMetrics() {
    const summary = this.metricsService.getPerformanceSummary();
    return {
      externalServices: summary.externalServices,
      serviceDetails: {
        userService: this.metricsService.getAggregatedMetrics('external_user-service'),
        securityService: this.metricsService.getAggregatedMetrics('external_security-service'),
        notificationService: this.metricsService.getAggregatedMetrics('external_notification-service'),
      },
    };
  }

  @Get('worker-metrics')
  @ApiOperation({ summary: 'Get worker process metrics' })
  @ApiResponse({ status: 200, description: 'Returns worker process metrics' })
  getWorkerMetrics() {
    return this.workerProcess.getWorkerMetrics();
  }

  @Post('test-worker')
  @ApiOperation({ summary: 'Test worker operation' })
  @ApiResponse({ status: 200, description: 'Worker test completed' })
  async testWorkerOperation(@Body() body: { type: string; payload: any }) {
    try {
      const result = await this.workerProcess.executeInWorker(
        body.type,
        body.payload
      );
      return {
        success: true,
        result,
        message: 'Worker operation completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Worker operation failed',
      };
    }
  }

  @Get('bottlenecks')
  @ApiOperation({ summary: 'Identify system bottlenecks' })
  @ApiResponse({ status: 200, description: 'Returns identified bottlenecks and recommendations' })
  getBottlenecks() {
    const performance = this.metricsService.getPerformanceSummary();
    const queueStatus = this.priorityQueue.getStatus();
    const workerMetrics = this.workerProcess.getWorkerMetrics();

    const bottlenecks = [];

    // Check auth flow bottlenecks
    if (performance.authFlow.averageLoginTime > 3000) {
      bottlenecks.push({
        type: 'auth_performance',
        severity: 'high',
        description: 'Login operations are taking longer than 3 seconds',
        metric: performance.authFlow.averageLoginTime,
      });
    }

    // Check queue bottlenecks
    const totalQueued = Object.values(queueStatus.queues).reduce((sum, size) => sum + size, 0);
    if (totalQueued > 500) {
      bottlenecks.push({
        type: 'queue_backlog',
        severity: 'medium',
        description: 'High number of queued operations',
        metric: totalQueued,
      });
    }

    // Check worker bottlenecks
    const workerUtilization = this.calculateWorkerUtilization();
    if (workerUtilization > 90) {
      bottlenecks.push({
        type: 'worker_saturation',
        severity: 'high',
        description: 'Worker processes are highly utilized',
        metric: workerUtilization,
      });
    }

    return {
      bottlenecks,
      recommendations: this.generateRecommendations(bottlenecks),
    };
  }

  @Post('reset-metrics')
  @ApiOperation({ summary: 'Reset all metrics (admin only)' })
  @ApiResponse({ status: 200, description: 'Metrics reset successfully' })
  resetMetrics() {
    this.metricsService.reset();
    return { message: 'All metrics reset successfully' };
  }

  private calculateWorkerUtilization(): number {
    const workerMetrics = this.workerProcess.getWorkerMetrics();
    if (workerMetrics.totalWorkers === 0) return 0;
    
    const busyWorkers = workerMetrics.pendingTasks;
    return (busyWorkers / workerMetrics.totalWorkers) * 100;
  }

  private generateRecommendations(bottlenecks: any[]): string[] {
    const recommendations = [];

    bottlenecks.forEach(bottleneck => {
      switch (bottleneck.type) {
        case 'auth_performance':
          recommendations.push('Consider optimizing database queries or adding caching for user lookups');
          recommendations.push('Review external service call timeouts and implement circuit breakers');
          break;
        case 'queue_backlog':
          recommendations.push('Increase worker processes or optimize task processing');
          recommendations.push('Consider implementing queue prioritization or load shedding');
          break;
        case 'worker_saturation':
          recommendations.push('Scale up worker processes or optimize worker task efficiency');
          recommendations.push('Consider distributing workers across multiple instances');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }
}