import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistributedTransactionService } from './distributed-transaction.service';
import { ConsistencyMetricsService } from './consistency-metrics.service';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../../database/database.module';

/**
 * Минимальный модуль для скрипта проверки консистентности
 * Содержит только необходимые зависимости без лишних сервисов
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    RedisModule,
    DatabaseModule,
  ],
  providers: [
    DistributedTransactionService,
    ConsistencyMetricsService,
  ],
  exports: [
    DistributedTransactionService,
    ConsistencyMetricsService,
  ],
})
export class ConsistencyCheckModule {}