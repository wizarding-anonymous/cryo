import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friendship } from './entities/friendship.entity';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { ClientsModule } from '../clients/clients.module';
import { CacheService } from '../cache/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship]), ClientsModule],
  controllers: [FriendsController],
  providers: [FriendsService, CacheService],
  exports: [FriendsService],
})
export class FriendsModule {}
