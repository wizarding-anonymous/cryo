import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { FriendsModule } from '../friends/friends.module';
import { MessagingService } from './messaging.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), FriendsModule],
  controllers: [MessagesController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagesModule {}
