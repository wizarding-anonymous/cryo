import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventEmitterService } from './event.emitter.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const kafkaEnabled = configService.get<boolean>('kafka.enabled');
          if (!kafkaEnabled) {
            // Return a dummy configuration if Kafka is disabled
            return { transport: Transport.TCP, options: {} };
          }
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: [configService.get<string>('kafka.broker')],
              },
              consumer: {
                groupId: 'library-service-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [EventEmitterService],
  exports: [EventEmitterService],
})
export class EventsModule {}
