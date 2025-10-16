import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MetricsService } from './metrics.service';

/**
 * System Metrics Service
 * Collects and updates system-level metrics periodically
 */
@Injectable()
export class SystemMetricsService implements OnModuleInit {
  private readonly logger = new Logger(SystemMetricsService.name);
  private activeConnections = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    this.logger.log('SystemMetricsService initialized');
    // Initial metrics collection
    await this.collectSystemMetrics();
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      this.metricsService.updateSystemMetrics(metrics);
    } catch (error) {
      this.logger.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Gather all system metrics
   */
  private async gatherSystemMetrics(): Promise<{
    activeConnections: number;
    memoryUsage: number;
    databasePoolSize: number;
  }> {
    const [memoryUsage, databasePoolSize] = await Promise.all([
      this.getMemoryUsage(),
      this.getDatabasePoolSize(),
    ]);

    return {
      activeConnections: this.activeConnections,
      memoryUsage,
      databasePoolSize,
    };
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed;
  }

  /**
   * Get database connection pool size
   */
  private async getDatabasePoolSize(): Promise<number> {
    try {
      if (this.dataSource?.isInitialized) {
        // Get connection pool information
        const driver = this.dataSource.driver as any;
        if (driver?.master?.totalCount !== undefined) {
          return driver.master.totalCount;
        }
        // Fallback for different driver types
        return this.dataSource.options?.extra?.max || 0;
      }
      return 0;
    } catch (error) {
      this.logger.error('Error getting database pool size:', error);
      return 0;
    }
  }

  /**
   * Increment active connections counter
   */
  incrementActiveConnections(): void {
    this.activeConnections++;
  }

  /**
   * Decrement active connections counter
   */
  decrementActiveConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  /**
   * Get current system metrics snapshot
   */
  async getSystemMetricsSnapshot(): Promise<{
    activeConnections: number;
    memoryUsage: number;
    databasePoolSize: number;
    uptime: number;
    nodeVersion: string;
    platform: string;
  }> {
    const systemMetrics = await this.gatherSystemMetrics();

    return {
      ...systemMetrics,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  /**
   * Get memory usage breakdown
   */
  getMemoryUsageBreakdown(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } {
    return process.memoryUsage();
  }

  /**
   * Get CPU usage (approximation)
   */
  getCpuUsage(): {
    user: number;
    system: number;
  } {
    return process.cpuUsage();
  }
}
