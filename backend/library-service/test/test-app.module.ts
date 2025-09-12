import { Module } from '@nestjs/common';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { LibraryModule } from '../src/library/library.module';
import { HistoryModule } from '../src/history/history.module';
import { HealthModule } from '../src/health/health.module';
import { ConfigModule } from '../src/config/config.module';

@Module({
  imports: [
    ConfigModule,
    // Note: We're not importing TypeORM and Cache modules for e2e tests
    // to avoid database connection issues during testing
    LibraryModule,
    HistoryModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class TestAppModule {}
