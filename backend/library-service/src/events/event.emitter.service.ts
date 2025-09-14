import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { GameAddedToLibraryEvent, GameRemovedFromLibraryEvent } from './dto/events.dto';

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private readonly logger = new Logger(EventEmitterService.name);
  private kafkaEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('KAFKA_SERVICE') private readonly client: ClientKafka,
  ) {
    this.kafkaEnabled = this.configService.get<boolean>('kafka.enabled', false);
  }

  async onModuleInit() {
    if (this.kafkaEnabled && this.client) {
      try {
        await this.client.connect();
        this.logger.log('Kafka client connected successfully');
        this.logger.log('EventEmitterService initialized with Kafka support');
      } catch (error) {
        this.logger.error('Failed to connect Kafka client', error.stack);
        this.kafkaEnabled = false; // Disable if connection fails
      }
    } else {
      this.logger.log('EventEmitterService initialized without Kafka (MVP mode)');
    }
  }

  async emitGameAddedEvent(userId: string, gameId: string): Promise<void> {
    const event: GameAddedToLibraryEvent = { userId, gameId, timestamp: new Date() };
    
    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.added event: ${JSON.stringify(event)}`);
      this.client.emit('game.added', event);
    } else {
      this.logger.debug(`Game added event (MVP mode - no Kafka): ${JSON.stringify(event)}`);
    }
  }

  async emitGameRemovedEvent(userId: string, gameId: string): Promise<void> {
    const event: GameRemovedFromLibraryEvent = { userId, gameId, timestamp: new Date() };
    
    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.removed event: ${JSON.stringify(event)}`);
      this.client.emit('game.removed', event);
    } else {
      this.logger.debug(`Game removed event (MVP mode - no Kafka): ${JSON.stringify(event)}`);
    }
  }
}
