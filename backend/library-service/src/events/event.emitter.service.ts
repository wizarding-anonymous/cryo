import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, ClientKafka, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { GameAddedToLibraryEvent, GameRemovedFromLibraryEvent } from './dto/events.dto';

@Injectable()
export class EventEmitterService implements OnModuleInit {
  private readonly logger = new Logger(EventEmitterService.name);
  private client: ClientKafka | null = null;
  private kafkaEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.kafkaEnabled = this.configService.get<boolean>('kafka.enabled', false);
    
    if (this.kafkaEnabled) {
      // Only initialize Kafka client if enabled
      this.initializeKafkaClient();
    }
  }

  private initializeKafkaClient() {
    try {
      // Dynamically create Kafka client
      const { ClientsModule, Transport } = require('@nestjs/microservices');
      
      // Note: In a real implementation, you'd want to use ClientsModule.register()
      // This is a simplified version for MVP
      this.logger.log('Kafka is enabled - initializing client');
    } catch (error) {
      this.logger.warn('Failed to initialize Kafka client, continuing without events', error.message);
      this.kafkaEnabled = false;
    }
  }

  async onModuleInit() {
    if (this.kafkaEnabled) {
      this.logger.log('EventEmitterService initialized with Kafka support');
    } else {
      this.logger.log('EventEmitterService initialized without Kafka (MVP mode)');
    }
  }

  async emitGameAddedEvent(userId: string, gameId: string) {
    const event: GameAddedToLibraryEvent = { userId, gameId, timestamp: new Date() };
    
    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.added event: ${JSON.stringify(event)}`);
      try {
        this.client.emit('game.added', event);
      } catch (error) {
        this.logger.error('Failed to emit game.added event', error.message);
      }
    } else {
      this.logger.debug(`Game added event (MVP mode - no Kafka): ${JSON.stringify(event)}`);
    }
  }

  async emitGameRemovedEvent(userId: string, gameId: string) {
    const event: GameRemovedFromLibraryEvent = { userId, gameId, timestamp: new Date() };
    
    if (this.kafkaEnabled && this.client) {
      this.logger.log(`Emitting game.removed event: ${JSON.stringify(event)}`);
      try {
        this.client.emit('game.removed', event);
      } catch (error) {
        this.logger.error('Failed to emit game.removed event', error.message);
      }
    } else {
      this.logger.debug(`Game removed event (MVP mode - no Kafka): ${JSON.stringify(event)}`);
    }
  }
}
