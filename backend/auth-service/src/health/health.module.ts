import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisModule } from '../common/redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [TerminusModule, HttpModule, RedisModule, DatabaseModule, CircuitBreakerModule],
  controllers: [HealthController],
})
export class HealthModule {}