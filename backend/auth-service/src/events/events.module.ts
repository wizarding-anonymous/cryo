import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventBusService } from './services/event-bus.service';
import {
    SecurityEventProcessor,
    NotificationEventProcessor,
    UserEventProcessor
} from './processors';
import { RepositoryModule } from '../repositories/repository.module';
import { HttpClientModule } from '../common/http-client/http-client.module';

@Module({
    imports: [
        RepositoryModule,
        HttpClientModule,
        // Configure Bull with Redis backend
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST', 'localhost'),
                    port: configService.get('REDIS_PORT', 6379),
                    password: configService.get('REDIS_PASSWORD'),
                    db: configService.get('REDIS_DB', 0),
                    retryDelayOnFailover: 100,
                    enableReadyCheck: false,
                    maxRetriesPerRequest: null,
                },
                defaultJobOptions: {
                    removeOnComplete: 100, // Keep last 100 completed jobs
                    removeOnFail: 50, // Keep last 50 failed jobs
                },
            }),
            inject: [ConfigService],
        }),

        // Register event queues with specific configurations
        BullModule.registerQueueAsync(
            {
                name: 'security-events',
                imports: [ConfigModule],
                useFactory: async () => ({
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                        removeOnComplete: 100,
                        removeOnFail: 50,
                    },
                    settings: {
                        stalledInterval: 30 * 1000, // 30 seconds
                        maxStalledCount: 1,
                    },
                }),
                inject: [ConfigService],
            },
            {
                name: 'notification-events',
                imports: [ConfigModule],
                useFactory: async () => ({
                    defaultJobOptions: {
                        attempts: 5,
                        backoff: {
                            type: 'exponential',
                            delay: 1000,
                        },
                        removeOnComplete: 100,
                        removeOnFail: 50,
                    },
                    settings: {
                        stalledInterval: 30 * 1000, // 30 seconds
                        maxStalledCount: 1,
                    },
                }),
                inject: [ConfigService],
            },
            {
                name: 'user-events',
                imports: [ConfigModule],
                useFactory: async () => ({
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 1500,
                        },
                        removeOnComplete: 100,
                        removeOnFail: 50,
                    },
                    settings: {
                        stalledInterval: 30 * 1000, // 30 seconds
                        maxStalledCount: 1,
                    },
                }),
                inject: [ConfigService],
            },
        ),
    ],
    providers: [
        EventBusService,
        SecurityEventProcessor,
        NotificationEventProcessor,
        UserEventProcessor,
    ],
    exports: [EventBusService],
})
export class EventsModule { }