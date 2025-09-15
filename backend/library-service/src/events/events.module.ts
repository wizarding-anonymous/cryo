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
            // Provide a harmless TCP client config to satisfy types; not used when kafka is disabled
            return {
              transport: Transport.TCP,
              options: {
                host: '127.0.0.1',
                port: 65535, // Unused dummy port
              },
            };
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
