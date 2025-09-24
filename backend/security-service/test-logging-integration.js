// Simple integration test for LoggingService
const { Test } = require('@nestjs/testing');
const { TypeOrmModule } = require('@nestjs/typeorm');
const { ConfigModule } = require('@nestjs/config');
const { WinstonModule } = require('nest-winston');

// Import the modules and services we need
const { LogsModule } = require('./dist/modules/logs/logs.module');
const { LoggingService } = require('./dist/modules/logs/logging.service');
const { SecurityEvent } = require('./dist/entities/security-event.entity');
const { SecurityEventType } = require('./dist/common/enums/security-event-type.enum');
const { RedisModule } = require('./dist/redis/redis.module');
const { winstonLogger } = require('./dist/config/logger.config');

async function testLoggingService() {
  console.log('🧪 Testing LoggingService integration...');
  
  try {
    // Create a test module with in-memory database
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [SecurityEvent],
          synchronize: true,
          logging: false,
        }),
        WinstonModule.forRoot(winstonLogger),
        // Mock Redis module for testing
        {
          module: class MockRedisModule {},
          providers: [
            {
              provide: 'REDIS_CLIENT',
              useValue: {
                get: jest.fn().mockResolvedValue(null),
                set: jest.fn().mockResolvedValue('OK'),
                del: jest.fn().mockResolvedValue(1),
              },
            },
          ],
          exports: ['REDIS_CLIENT'],
        },
        LogsModule,
      ],
    }).compile();

    const loggingService = moduleRef.get(LoggingService);
    
    console.log('✅ LoggingService instance created successfully');

    // Test logSecurityEvent
    const testEvent = {
      type: SecurityEventType.LOGIN,
      userId: 'test-user-123',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      data: { sessionId: 'test-session', location: 'Moscow' },
      riskScore: 25,
    };

    const savedEvent = await loggingService.logSecurityEvent(testEvent);
    console.log('✅ logSecurityEvent works:', savedEvent.id);

    // Test getSecurityLogs with pagination
    const logs = await loggingService.getSecurityLogs({
      page: 1,
      pageSize: 10,
    });
    console.log('✅ getSecurityLogs works:', logs.total, 'events found');

    // Test getUserSecurityEvents
    const userEvents = await loggingService.getUserSecurityEvents('test-user-123');
    console.log('✅ getUserSecurityEvents works:', userEvents.length, 'events found');

    // Test getEventsByType
    const loginEvents = await loggingService.getEventsByType(SecurityEventType.LOGIN);
    console.log('✅ getEventsByType works:', loginEvents.length, 'login events found');

    await moduleRef.close();
    console.log('🎉 All LoggingService tests passed!');
    
  } catch (error) {
    console.error('❌ LoggingService test failed:', error.message);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testLoggingService();
}

module.exports = { testLoggingService };