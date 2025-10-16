import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { BatchController } from './batch.controller';
import { InternalController } from './internal.controller';
import { BatchService } from './batch.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CacheModule } from '../common/cache/cache.module';
import { MetricsModule } from '../common/metrics/metrics.module';
import { ProfileModule } from '../profile/profile.module';
import { OptimizedUserRepository } from './repositories/optimized-user.repository';
import { OptimizedUserService } from './services/optimized-user.service';
import { OptimizedUserController } from './controllers/optimized-user.controller';
import { PaginationService } from '../common/services/pagination.service';
import { UserEncryptionService } from './services/user-encryption.service';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    IntegrationsModule,
    CacheModule,
    EncryptionModule,
    DatabaseModule,
    forwardRef(() => MetricsModule),
    forwardRef(() => ProfileModule), // Используем forwardRef для избежания циклической зависимости
  ],
  providers: [
    UserService,
    BatchService,
    OptimizedUserRepository,
    OptimizedUserService,
    PaginationService,
    UserEncryptionService,
  ],
  controllers: [
    UserController,
    BatchController,
    InternalController,
    OptimizedUserController,
  ],
  exports: [
    UserService,
    BatchService,
    OptimizedUserRepository,
    OptimizedUserService,
    PaginationService,
    UserEncryptionService,
  ], // Export services to make them available to other modules.
})
export class UserModule {}
