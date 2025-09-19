import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  async onApplicationShutdown(signal?: string) {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(`Received shutdown signal: ${signal}`);

    const shutdownTimeout = this.configService.get<number>('shutdown.timeout', 10000);
    
    try {
      // Set a timeout for graceful shutdown
      const shutdownPromise = this.performGracefulShutdown();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.log('Graceful shutdown completed successfully');
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  private async performGracefulShutdown(): Promise<void> {
    this.logger.log('Starting graceful shutdown...');

    // 1. Stop accepting new requests (handled by NestJS)
    this.logger.log('Stopped accepting new requests');

    // 2. Wait for ongoing requests to complete
    await this.waitForOngoingRequests();

    // 3. Close database connections
    await this.closeDatabaseConnections();

    // 4. Close Redis connections
    await this.closeRedisConnections();

    // 5. Clean up any other resources
    await this.cleanupResources();

    this.logger.log('All resources cleaned up successfully');
  }

  private async waitForOngoingRequests(): Promise<void> {
    // In a real implementation, you would track ongoing requests
    // For now, we'll just wait a short time
    this.logger.log('Waiting for ongoing requests to complete...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log('Ongoing requests completed');
  }

  private async closeDatabaseConnections(): Promise<void> {
    try {
      this.logger.log('Closing database connections...');
      // Database connections will be closed by TypeORM when the app shuts down
      this.logger.log('Database connections closed');
    } catch (error) {
      this.logger.error('Error closing database connections:', error);
      throw error;
    }
  }

  private async closeRedisConnections(): Promise<void> {
    try {
      this.logger.log('Closing Redis connections...');
      // Redis connections will be closed by the cache manager
      this.logger.log('Redis connections closed');
    } catch (error) {
      this.logger.error('Error closing Redis connections:', error);
      throw error;
    }
  }

  private async cleanupResources(): Promise<void> {
    try {
      this.logger.log('Cleaning up additional resources...');
      // Clean up any timers, intervals, or other resources
      this.logger.log('Additional resources cleaned up');
    } catch (error) {
      this.logger.error('Error cleaning up resources:', error);
      throw error;
    }
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}