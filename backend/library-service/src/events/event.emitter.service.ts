import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import {
  GameAddedToLibraryEvent,
  GameRemovedFromLibraryEvent,
} from './dto/events.dto';

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private readonly logger = new Logger(EventEmitterService.name);
  private kafkaEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('KAFKA_SERVICE') private readonly client?: ClientKafka,
  ) {
    this.kafkaEnabled =
      this.configService.get<boolean>('kafka.enabled', false) === true;
  }

  async onModuleInit(): Promise<void> {
    if (this.kafkaEnabled && this.client) {
      try {
        await this.client.connect();
        this.logger.log('Kafka client connected successfully');
        this.logger.log('EventEmitterService initialized with Kafka support');
        this.logger.log('EventEmitterService initialized.');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.warn(
          `Failed to connect Kafka client, continuing without Kafka. Reason: ${message}`,
          stack,
        );
        this.kafkaEnabled = false;
      }
    } else {
      this.logger.log(
        'EventEmitterService initialized without Kafka (MVP mode)',
      );
      this.logger.log('EventEmitterService initialized.');
    }
  }

  async emitGameAddedEvent(userId: string, gameId: string): Promise<void> {
    const event = new GameAddedToLibraryEvent({
      userId,
      gameId,
      timestamp: new Date(),
    });

    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.added event: ${JSON.stringify(event)}`);
      await lastValueFrom(this.client.emit('game.added', event));
      return;
    }

    this.logger.log(
      `Emitting game.added event (MVP mode - no Kafka): ${JSON.stringify(event)}`,
    );
  }

  async emitGameRemovedEvent(userId: string, gameId: string): Promise<void> {
    const event = new GameRemovedFromLibraryEvent({
      userId,
      gameId,
      timestamp: new Date(),
    });

    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.removed event: ${JSON.stringify(event)}`);
      await lastValueFrom(this.client.emit('game.removed', event));
      return;
    }

    this.logger.log(
      `Emitting game.removed event (MVP mode - no Kafka): ${JSON.stringify(event)}`,
    );
  }
}
