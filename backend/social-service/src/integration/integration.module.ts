import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { Friendship } from '../friends/entities/friendship.entity';
import { ClientsModule } from '../clients/clients.module';
import { CacheConfigModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship]),
    ClientsModule,
    CacheConfigModule,
  ],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}