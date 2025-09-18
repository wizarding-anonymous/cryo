import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnlineStatus } from './entities/online-status.entity';
import { FriendsModule } from '../friends/friends.module';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnlineStatus]),
    FriendsModule,
  ],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
