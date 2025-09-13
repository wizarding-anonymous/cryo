import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private redis: RedisHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 300 }),
      () => this.redis.isHealthy('redis'),
      () => this.microservice.pingCheck('game-catalog-service', {
        transport: Transport.TCP,
        options: {
          host: this.configService.get('services.gamesCatalog.url').replace('http://', '').split(':')[0],
          port: parseInt(this.configService.get('services.gamesCatalog.url').split(':')[2] || '3001', 10),
        },
      }),
    ]);
  }
}
