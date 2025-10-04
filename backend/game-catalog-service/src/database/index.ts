// Database configuration and services
export { DatabaseModule } from './database.module';
export { DatabaseConfigService } from './database-config.service';
export { RedisConfigService } from './redis-config.service';
export { MigrationService } from './migration.service';
export { DatabaseHealthService } from './database-health.service';

// Database utilities
export { DatabaseConnectionUtil } from './database-connection.util';

// Cache utilities
export { Cache, CacheClear } from './cache.decorator';
export { CacheInterceptor } from './cache.interceptor';

// Re-export TypeORM decorators and types for convenience
export {
  InjectDataSource,
  InjectRepository,
  getDataSourceToken,
  getRepositoryToken,
} from '@nestjs/typeorm';
export { DataSource, Repository, EntityManager } from 'typeorm';
