import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { FriendsModule } from '../friends/friends.module';
import { MessagingService } from './messaging.service';
import { MessagesController } from './messages.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), FriendsModule, ClientsModule],
  controllers: [MessagesController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagesModule {}
