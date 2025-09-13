import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, ClientKafka, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { GameAddedToLibraryEvent, GameRemovedFromLibraryEvent } from './dto/events.dto';

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private readonly logger = new Logger(EventEmitterService.name);

  @Client({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'library-service',
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      },
      consumer: {
        groupId: 'library-service-consumer',
      },
    },
  })
  private client: ClientKafka;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // The client will automatically connect based on the app lifecycle
    this.logger.log('EventEmitterService initialized.');
  }

  async emitGameAddedEvent(userId: string, gameId: string) {
    const event: GameAddedToLibraryEvent = { userId, gameId, timestamp: new Date() };
    this.logger.log(`Emitting game.added event: ${JSON.stringify(event)}`);
    this.client.emit('game.added', event);
  }

  async emitGameRemovedEvent(userId: string, gameId: string) {
    const event: GameRemovedFromLibraryEvent = { userId, gameId, timestamp: new Date() };
    this.logger.log(`Emitting game.removed event: ${JSON.stringify(event)}`);
    this.client.emit('game.removed', event);
  }
}
