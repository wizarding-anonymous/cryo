import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '../common/redis/redis.module';
import { HttpClientModule } from '../common/http-client/http-client.module';
import { SagaService } from './saga.service';
import { AuthSagaService } from './auth-saga.service';
import { SagaController } from './saga.controller';
import { TokenModule } from '../token/token.module';
import { SessionModule } from '../session/session.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    RedisModule,
    HttpClientModule,
    TokenModule,
    SessionModule,
    EventsModule,
  ],
  controllers: [SagaController],
  providers: [
    SagaService,
    AuthSagaService,
  ],
  exports: [
    SagaService,
    AuthSagaService,
  ],
})
export class SagaModule {}