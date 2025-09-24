import 'dotenv/config';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

// Increase Jest timeout for integration tests
jest.setTimeout(60000);

let testDataSource: DataSource;
let testRedis: Redis;

// Global test setup
beforeAll(async () => {
  // Setup test database
  testDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5436'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'security_service_test',
    entities: ['src/entities/*.entity.ts'],
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  try {
    await testDataSource.initialize();
    console.log('Test database connected');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }

  // Setup test Redis
  testRedis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6382'),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  try {
    await testRedis.ping();
    console.log('Test Redis connected');
  } catch (error) {
    console.error('Failed to connect to test Redis:', error);
    throw error;
  }

  // Wait for services to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

// Global test teardown
afterAll(async () => {
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
    console.log('Test database disconnected');
  }

  if (testRedis) {
    testRedis.disconnect();
    console.log('Test Redis disconnected');
  }

  // Clean up any global resources
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

// Clean up between tests
beforeEach(async () => {
  if (testDataSource && testDataSource.isInitialized) {
    // Clear all tables
    const entities = testDataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = testDataSource.getRepository(entity.name);
      await repository.clear();
    }
  }

  if (testRedis) {
    // Clear Redis
    await testRedis.flushall();
  }
});

export { testDataSource, testRedis };