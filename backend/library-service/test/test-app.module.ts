import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';
import { LibraryService } from '../src/library/library.service';
import { SearchService } from '../src/library/search.service';
import { LibraryController } from '../src/library/library.controller';
import { LibraryRepository } from '../src/library/repositories/library.repository';
import { HistoryService } from '../src/history/history.service';
import { HistoryController } from '../src/history/history.controller';
import { PurchaseHistoryRepository } from '../src/history/repositories/purchase-history.repository';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { PaymentServiceClient } from '../src/clients/payment-service.client';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TestJwtStrategy } from './auth/test-jwt.strategy';
import { CacheService } from '../src/cache/cache.service';
import { BenchmarkService } from '../src/performance/benchmark.service';
import { PerformanceMonitorService } from '../src/performance/performance-monitor.service';
import { EventEmitterService } from '../src/events/event.emitter.service';
import { TestHealthController } from './controllers/test-health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5434'),
      username: process.env.DATABASE_USERNAME || 'library_service',
      password: process.env.DATABASE_PASSWORD || 'library_password',
      database: process.env.DATABASE_NAME || 'library_db',
      entities: [LibraryGame, PurchaseHistory],
      synchronize: true, // For tests only
      logging: false,
      dropSchema: false,
    }),
    TypeOrmModule.forFeature([LibraryGame, PurchaseHistory]),
    CacheModule.register({
      isGlobal: true,
      store: 'memory', // Use in-memory cache for tests
      max: 100,
      ttl: 300,
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests-only',
      signOptions: { expiresIn: '1h' },
      global: true,
    }),
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [LibraryController, HistoryController, TestHealthController],
  providers: [
    LibraryService,
    SearchService,
    LibraryRepository,
    HistoryService,
    PurchaseHistoryRepository,
    JwtAuthGuard,
    TestJwtStrategy,
    CacheService,
    BenchmarkService,
    PerformanceMonitorService,
    EventEmitterService,
    // External clients will be mocked in tests
    {
      provide: GameCatalogClient,
      useValue: {}, // Will be overridden in tests
    },
    {
      provide: UserServiceClient,
      useValue: {}, // Will be overridden in tests
    },
    {
      provide: PaymentServiceClient,
      useValue: {}, // Will be overridden in tests
    },
  ],
})
export class TestAppModule { }