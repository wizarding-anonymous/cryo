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
      // The TypeOrmHealthIndicator needs a TypeOrm connection to be injected to work.
      // This will be available as this module is imported into the root module.
      () => this.db.pingCheck('database', { timeout: 300 }),
      // The memory check will fail if the heap usage is over 250MB
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
      // The memory check will fail if the RSS usage is over 250MB
      () => this.memory.checkRSS('memory_rss', 250 * 1024 * 1024),
    ]);
  }
}
