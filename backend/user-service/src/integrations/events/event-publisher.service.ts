import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { UserEvent } from '../integration.service';

interface EventPublisherConfig {
  redisUrl: string;
  eventTtl: number;
  retryAttempts: number;
  retryDelay: number;
}

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);
  private readonly redis: Redis;
  private readonly config: EventPublisherConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      redisUrl: this.configService.get<string>(
        'REDIS_URL',
        'redis://localhost:6379',
      ),
      eventTtl: this.configService.get<number>('EVENT_TTL', 86400), // 24 hours
      retryAttempts: this.configService.get<number>('EVENT_RETRY_ATTEMPTS', 3),
      retryDelay: this.configService.get<number>('EVENT_RETRY_DELAY', 1000), // 1 second
    };

    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for event publishing');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error for event publishing', error);
    });
  }

  /**
   * Publish user event to other microservices
   */
  async publishEvent(event: UserEvent): Promise<void> {
    const eventKey = `user-events:${event.type.toLowerCase()}`;
    const eventData = {
      ...event,
      publishedAt: new Date().toISOString(),
      source: 'user-service',
    };

    try {
      this.logger.log(
        `Publishing event: ${event.type} for user ${event.userId}`,
      );

      // Publish to Redis pub/sub for real-time subscribers
      await this.publishToChannel(eventKey, eventData);

      // Store in Redis stream for reliable delivery
      await this.addToStream(eventKey, eventData);

      // Store in event history for audit
      await this.storeEventHistory(event, eventData);

      this.logger.log(
        `Successfully published event: ${event.type} for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event: ${event.type} for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish event to specific microservice
   */
  async publishToService(serviceName: string, event: UserEvent): Promise<void> {
    const serviceChannel = `service:${serviceName}:user-events`;
    const eventData = {
      ...event,
      publishedAt: new Date().toISOString(),
      source: 'user-service',
      targetService: serviceName,
    };

    try {
      this.logger.log(
        `Publishing event to ${serviceName}: ${event.type} for user ${event.userId}`,
      );

      await this.publishToChannel(serviceChannel, eventData);

      this.logger.log(
        `Successfully published event to ${serviceName}: ${event.type} for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event to ${serviceName}: ${event.type} for user ${event.userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish batch events
   */
  async publishBatchEvents(events: UserEvent[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const event of events) {
      const eventKey = `user-events:${event.type.toLowerCase()}`;
      const eventData = {
        ...event,
        publishedAt: new Date().toISOString(),
        source: 'user-service',
      };

      // Add to pipeline
      pipeline.publish(eventKey, JSON.stringify(eventData));
      pipeline.xadd(
        `stream:${eventKey}`,
        '*',
        'data',
        JSON.stringify(eventData),
      );
    }

    try {
      this.logger.log(`Publishing batch of ${events.length} events`);
      await pipeline.exec();
      this.logger.log(
        `Successfully published batch of ${events.length} events`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish batch events`, error);
      throw error;
    }
  }

  /**
   * Get event publishing statistics
   */
  async getPublishingStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: any[];
  }> {
    try {
      const stats = {
        totalEvents: 0,
        eventsByType: {} as Record<string, number>,
        recentEvents: [] as any[],
      };

      // Get total events count
      const totalKey = 'user-service:events:total';
      const total = await this.redis.get(totalKey);
      stats.totalEvents = parseInt(total || '0', 10);

      // Get events by type
      const typeKeys = await this.redis.keys('user-service:events:type:*');
      for (const key of typeKeys) {
        const type = key.split(':').pop();
        const count = await this.redis.get(key);
        stats.eventsByType[type] = parseInt(count || '0', 10);
      }

      // Get recent events
      const recentEvents = await this.redis.lrange(
        'user-service:events:recent',
        0,
        9,
      );
      stats.recentEvents = recentEvents.map((event) => JSON.parse(event));

      return stats;
    } catch (error) {
      this.logger.error('Failed to get publishing stats', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        recentEvents: [],
      };
    }
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents(): Promise<void> {
    try {
      const failedEvents = await this.redis.lrange(
        'user-service:events:failed',
        0,
        -1,
      );

      if (failedEvents.length === 0) {
        this.logger.log('No failed events to retry');
        return;
      }

      this.logger.log(`Retrying ${failedEvents.length} failed events`);

      for (const eventStr of failedEvents) {
        try {
          const event = JSON.parse(eventStr);
          await this.publishEvent(event);

          // Remove from failed queue on success
          await this.redis.lrem('user-service:events:failed', 1, eventStr);
        } catch (error) {
          this.logger.error('Failed to retry event', error);
        }
      }

      this.logger.log('Completed retry of failed events');
    } catch (error) {
      this.logger.error('Failed to retry failed events', error);
    }
  }

  /**
   * Publish to Redis channel
   */
  private async publishToChannel(
    channel: string,
    eventData: any,
  ): Promise<void> {
    const subscribers = await this.redis.publish(
      channel,
      JSON.stringify(eventData),
    );
    this.logger.debug(
      `Published to channel ${channel}, ${subscribers} subscribers notified`,
    );
  }

  /**
   * Add event to Redis stream
   */
  private async addToStream(streamKey: string, eventData: any): Promise<void> {
    const streamName = `stream:${streamKey}`;
    await this.redis.xadd(streamName, '*', 'data', JSON.stringify(eventData));

    // Set TTL on stream
    await this.redis.expire(streamName, this.config.eventTtl);
  }

  /**
   * Store event in history for audit
   */
  private async storeEventHistory(
    event: UserEvent,
    eventData: any,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Increment total counter
    pipeline.incr('user-service:events:total');

    // Increment type counter
    pipeline.incr(`user-service:events:type:${event.type}`);

    // Add to recent events list (keep last 100)
    pipeline.lpush('user-service:events:recent', JSON.stringify(eventData));
    pipeline.ltrim('user-service:events:recent', 0, 99);

    // Store detailed event with TTL
    const eventKey = `user-service:event:${event.correlationId}`;
    pipeline.setex(eventKey, this.config.eventTtl, JSON.stringify(eventData));

    await pipeline.exec();
  }

  /**
   * Health check for event publisher
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error('Event publisher health check failed', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('Event publisher Redis connection closed');
  }
}
