import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseHistory } from './entities/purchase-history.entity';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { ClientsModule } from '../clients/clients.module';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseHistory]), 
    ClientsModule,
    AppCacheModule
  ],
  controllers: [HistoryController],
  providers: [HistoryService, PurchaseHistoryRepository],
  exports: [HistoryService],
})
export class HistoryModule {}
