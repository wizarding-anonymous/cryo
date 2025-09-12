import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // The TypeOrmHealthIndicator needs the TypeOrmModule to be running
      () => this.db.pingCheck('database', { timeout: 300 }),

      // Check an external microservice (e.g., Game Catalog Service)
      () => this.microservice.pingCheck('game-catalog-service', {
        transport: Transport.TCP,
        options: {
          host: this.configService.get('services.gamesCatalog.url').replace('http://', '').split(':')[0],
          port: parseInt(this.configService.get('services.gamesCatalog.url').split(':')[2] || '3001', 10),
        },
      }),
      // A Redis health check would require a custom indicator or a different library
      // as Terminus does not have a built-in one for Redis with cache-manager v5.
    ]);
  }
}
