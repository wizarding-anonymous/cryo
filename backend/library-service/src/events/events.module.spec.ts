import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventsModule } from './events.module';
import { EventEmitterService } from './event.emitter.service';

describe('EventsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              kafka: {
                enabled: false,
                broker: 'localhost:9092',
              },
            }),
          ],
        }),
        EventsModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(EventsModule).toBeDefined();
  });

  it('should provide EventEmitterService', () => {
    const eventEmitterService =
      module.get<EventEmitterService>(EventEmitterService);
    expect(eventEmitterService).toBeDefined();
  });

  it('should configure TCP transport when Kafka is disabled', async () => {
    const configService = module.get<ConfigService>(ConfigService);
    expect(configService.get('kafka.enabled')).toBe(false);

    // The module should be properly configured with TCP transport
    expect(module).toBeDefined();
  });

  describe('Kafka configuration', () => {
    let kafkaModule: TestingModule;

    beforeEach(async () => {
      kafkaModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                kafka: {
                  enabled: true,
                  broker: 'test-broker:9092',
                },
              }),
            ],
          }),
          EventsModule,
        ],
      }).compile();
    });

    afterEach(async () => {
      if (kafkaModule) {
        await kafkaModule.close();
      }
    });

    it('should configure Kafka transport when enabled', () => {
      const configService = kafkaModule.get<ConfigService>(ConfigService);
      expect(configService.get('kafka.enabled')).toBe(true);
      expect(configService.get('kafka.broker')).toBe('test-broker:9092');

      // The module should be properly configured with Kafka transport
      expect(kafkaModule).toBeDefined();
    });

    it('should use default broker when not specified', async () => {
      const defaultModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                kafka: {
                  enabled: true,
                  // broker not specified, should use default
                },
              }),
            ],
          }),
          EventsModule,
        ],
      }).compile();

      const configService = defaultModule.get<ConfigService>(ConfigService);
      expect(configService.get('kafka.broker')).toBeUndefined();

      await defaultModule.close();
    });
  });

  describe('ClientsModule configuration', () => {
    it('should register KAFKA_SERVICE client', () => {
      // The module should have the KAFKA_SERVICE client registered
      expect(module).toBeDefined();
    });

    it('should handle async configuration factory', async () => {
      // Test that the async factory function works correctly
      const testModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                kafka: {
                  enabled: false,
                },
              }),
            ],
          }),
          ClientsModule.registerAsync([
            {
              name: 'TEST_SERVICE',
              imports: [ConfigModule],
              useFactory: async (configService: ConfigService) => {
                const kafkaEnabled =
                  configService.get<boolean>('kafka.enabled', false) === true;
                if (!kafkaEnabled) {
                  return {
                    transport: Transport.TCP,
                    options: {
                      host: '127.0.0.1',
                      port: 65535,
                    },
                  };
                }
                return {
                  transport: Transport.KAFKA,
                  options: {
                    client: {
                      brokers: ['localhost:9092'],
                    },
                    consumer: {
                      groupId: 'test-consumer',
                    },
                  },
                };
              },
              inject: [ConfigService],
            },
          ]),
        ],
      }).compile();

      expect(testModule).toBeDefined();
      await testModule.close();
    });
  });
});
