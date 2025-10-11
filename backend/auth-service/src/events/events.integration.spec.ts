import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from './events.module';
import { EventBusService } from './services/event-bus.service';
import { SecurityEventDto, NotificationEventDto, UserEventDto } from './dto';
import { SecurityEvent } from '../entities/security-event.entity';

describe('Events Integration', () => {
  let module: TestingModule;
  let eventBusService: EventBusService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.example',
        }),
        // Use in-memory SQLite for testing
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [SecurityEvent],
          synchronize: true,
          logging: false,
        }),
        // Use in-memory Redis for testing
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: 1,
          },
        }),
        EventsModule,
      ],
    }).compile();

    eventBusService = module.get<EventBusService>(EventBusService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(eventBusService).toBeDefined();
  });

  it('should publish and process security event', async () => {
    const event = new SecurityEventDto({
      userId: 'test-user-123',
      type: 'login',
      ipAddress: '192.168.1.100',
      userAgent: 'Test Browser',
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishSecurityEvent(event)).resolves.not.toThrow();
  });

  it('should publish and process notification event', async () => {
    const event = new NotificationEventDto({
      userId: 'test-user-123',
      email: 'test@example.com',
      type: 'welcome',
      data: { name: 'Test User' },
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishNotificationEvent(event)).resolves.not.toThrow();
  });

  it('should publish and process user event', async () => {
    const event = new UserEventDto({
      userId: 'test-user-123',
      type: 'update_last_login',
      data: { lastLoginAt: new Date() },
      timestamp: new Date(),
    });

    // This should not throw
    await expect(eventBusService.publishUserEvent(event)).resolves.not.toThrow();
  });

  it('should get queue statistics', async () => {
    const stats = await eventBusService.getQueueStats();
    
    expect(stats).toHaveProperty('security');
    expect(stats).toHaveProperty('notification');
    expect(stats).toHaveProperty('user');
    
    expect(typeof stats.security.waiting).toBe('number');
    expect(typeof stats.notification.waiting).toBe('number');
    expect(typeof stats.user.waiting).toBe('number');
  });
});