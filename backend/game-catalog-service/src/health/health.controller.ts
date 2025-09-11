import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Check the database connection
      () => this.db.pingCheck('database', { timeout: 300 }),
      // Check that the heap memory usage is not over 250MB
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
      // Check that the RSS memory usage is not over 250MB
      () => this.memory.checkRSS('memory_rss', 250 * 1024 * 1024),
    ]);
  }
}
