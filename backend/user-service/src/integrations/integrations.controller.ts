import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { EventPublisherService } from './events/event-publisher.service';
import { AuthServiceClient } from './auth/auth-service.client';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly eventPublisherService: EventPublisherService,
    private readonly authServiceClient: AuthServiceClient,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get integration services health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status of all integration services',
  })
  async getHealthStatus() {
    const [circuitBreakerHealth, eventPublisherHealth, authServiceHealth] =
      await Promise.allSettled([
        this.circuitBreakerService.getHealthStatus(),
        this.eventPublisherService.healthCheck(),
        this.authServiceClient.healthCheck(),
      ]);

    return {
      timestamp: new Date().toISOString(),
      status: 'ok',
      services: {
        circuitBreaker: {
          status:
            circuitBreakerHealth.status === 'fulfilled'
              ? 'healthy'
              : 'unhealthy',
          details:
            circuitBreakerHealth.status === 'fulfilled'
              ? circuitBreakerHealth.value
              : { error: circuitBreakerHealth.reason?.message },
        },
        eventPublisher: {
          status:
            eventPublisherHealth.status === 'fulfilled' &&
            eventPublisherHealth.value
              ? 'healthy'
              : 'unhealthy',
          details:
            eventPublisherHealth.status === 'fulfilled'
              ? { connected: eventPublisherHealth.value }
              : { error: eventPublisherHealth.reason?.message },
        },
        authService: {
          status:
            authServiceHealth.status === 'fulfilled' && authServiceHealth.value
              ? 'healthy'
              : 'unhealthy',
          details:
            authServiceHealth.status === 'fulfilled'
              ? { connected: authServiceHealth.value }
              : { error: authServiceHealth.reason?.message },
        },
      },
    };
  }

  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get all circuit breakers status' })
  @ApiResponse({ status: 200, description: 'Status of all circuit breakers' })
  async getCircuitBreakersStatus() {
    return {
      timestamp: new Date().toISOString(),
      circuits: this.circuitBreakerService.getAllCircuitsStatus(),
    };
  }

  @Get('circuit-breakers/:name')
  @ApiOperation({ summary: 'Get specific circuit breaker status' })
  @ApiResponse({
    status: 200,
    description: 'Status of specific circuit breaker',
  })
  async getCircuitBreakerStatus(@Param('name') name: string) {
    const stats = this.circuitBreakerService.getCircuitStats(name);

    if (!stats) {
      return {
        name,
        exists: false,
        message: 'Circuit breaker not found',
      };
    }

    return {
      name,
      exists: true,
      stats,
    };
  }

  @Post('circuit-breakers/:name/reset')
  @ApiOperation({ summary: 'Reset specific circuit breaker' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker reset successfully',
  })
  async resetCircuitBreaker(@Param('name') name: string) {
    this.circuitBreakerService.resetCircuit(name);

    return {
      name,
      action: 'reset',
      timestamp: new Date().toISOString(),
      message: 'Circuit breaker reset successfully',
    };
  }

  @Post('circuit-breakers/:name/open')
  @ApiOperation({ summary: 'Manually open specific circuit breaker' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker opened successfully',
  })
  async openCircuitBreaker(@Param('name') name: string) {
    this.circuitBreakerService.openCircuit(name);

    return {
      name,
      action: 'open',
      timestamp: new Date().toISOString(),
      message: 'Circuit breaker opened successfully',
    };
  }

  @Get('events/stats')
  @ApiOperation({ summary: 'Get event publishing statistics' })
  @ApiResponse({ status: 200, description: 'Event publishing statistics' })
  async getEventStats() {
    const stats = await this.eventPublisherService.getPublishingStats();

    return {
      timestamp: new Date().toISOString(),
      ...stats,
    };
  }

  @Post('events/retry-failed')
  @ApiOperation({ summary: 'Retry failed events' })
  @ApiResponse({ status: 200, description: 'Failed events retry initiated' })
  async retryFailedEvents() {
    // Run retry in background
    this.eventPublisherService.retryFailedEvents().catch((error) => {
      console.error('Failed to retry events:', error);
    });

    return {
      action: 'retry-failed-events',
      timestamp: new Date().toISOString(),
      message: 'Failed events retry initiated',
    };
  }

  @Post('test/user-event')
  @ApiOperation({ summary: 'Test user event publishing' })
  @ApiResponse({
    status: 200,
    description: 'Test event published successfully',
  })
  async testUserEvent(
    @Body() eventData: { userId: string; type: string; data?: any },
  ) {
    const testEvent = {
      type: eventData.type as any,
      userId: eventData.userId,
      timestamp: new Date(),
      data: eventData.data || { test: true },
      correlationId: `test-${Date.now()}`,
    };

    try {
      await this.integrationService.publishUserEvent(testEvent);

      return {
        success: true,
        event: testEvent,
        message: 'Test event published successfully',
      };
    } catch (error) {
      return {
        success: false,
        event: testEvent,
        error: error.message,
        message: 'Failed to publish test event',
      };
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get integration metrics' })
  @ApiResponse({ status: 200, description: 'Integration service metrics' })
  async getMetrics() {
    const [circuitBreakerHealth, eventStats] = await Promise.allSettled([
      this.circuitBreakerService.getHealthStatus(),
      this.eventPublisherService.getPublishingStats(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      metrics: {
        circuitBreakers: {
          status:
            circuitBreakerHealth.status === 'fulfilled' ? 'success' : 'error',
          data:
            circuitBreakerHealth.status === 'fulfilled'
              ? circuitBreakerHealth.value
              : { error: circuitBreakerHealth.reason?.message },
        },
        eventPublishing: {
          status: eventStats.status === 'fulfilled' ? 'success' : 'error',
          data:
            eventStats.status === 'fulfilled'
              ? eventStats.value
              : { error: eventStats.reason?.message },
        },
      },
    };
  }
}
