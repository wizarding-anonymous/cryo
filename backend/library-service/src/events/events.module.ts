import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport, type KafkaOptions } from '@nestjs/microservices';
import { EventEmitterService } from './event.emitter.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const kafkaEnabled = configService.get<boolean>('kafka.enabled', false) === true;
          if (!kafkaEnabled) {
            return {
              transport: Transport.TCP,
              options: {
                host: '127.0.0.1',
                port: 65535,
              },
            };
          }

          const broker = configService.get<string>('kafka.broker') ?? 'localhost:9092';
          const kafkaOptions: KafkaOptions = {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: [broker],
              },
              consumer: {
                groupId: 'library-service-consumer',
              },
            },
          };

          return kafkaOptions;
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [EventEmitterService],
  exports: [EventEmitterService],
})
export class EventsModule {}
