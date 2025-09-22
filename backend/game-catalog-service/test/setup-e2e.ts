import { DataSource } from 'typeorm';
import { Game } from '../src/entities/game.entity';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let testDataSource: DataSource;

/**
 * Global setup for e2e tests
 * Initializes test database connection and creates test schema
 */
export const setupTestDatabase = async (): Promise<DataSource> => {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  testDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5433,
    username: process.env.POSTGRES_USER || 'test_user',
    password: process.env.POSTGRES_PASSWORD || 'test_password',
    database: process.env.POSTGRES_DB || 'game_catalog_test_db',
    entities: [Game],
    synchronize: true, // Use synchronize for tests to auto-create schema
    dropSchema: false, // Don't drop schema automatically
    logging: false, // Disable logging for cleaner test output
  });

  try {
    await testDataSource.initialize();
    console.log('Test database connection established');
    return testDataSource;
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

/**
 * Clean up test database
 */
export const cleanupTestDatabase = async (): Promise<void> => {
  if (testDataSource && testDataSource.isInitialized) {
    // Clean up all test data
    await testDataSource.getRepository(Game).clear();
    await testDataSource.destroy();
    console.log('Test database cleaned up');
  }
};

/**
 * Seed test data for integration tests
 */
export const seedTestData = async (): Promise<Game[]> => {
  if (!testDataSource || !testDataSource.isInitialized) {
    throw new Error('Test database not initialized');
  }

  const gameRepository = testDataSource.getRepository(Game);

  const testGames = [
    {
      title: 'Test Game 1',
      description: 'A test game for integration testing',
      shortDescription: 'Test game 1',
      price: 29.99,
      currency: 'RUB',
      genre: 'Action',
      developer: 'Test Studio',
      publisher: 'Test Publisher',
      releaseDate: new Date('2023-01-01'),
      images: ['test1.jpg'],
      systemRequirements: {
        minimum: 'Test minimum requirements',
        recommended: 'Test recommended requirements',
      },
      available: true,
    },
    {
      title: 'Test Game 2',
      description: 'Another test game for integration testing',
      shortDescription: 'Test game 2',
      price: 49.99,
      currency: 'RUB',
      genre: 'RPG',
      developer: 'Test Studio 2',
      publisher: 'Test Publisher 2',
      releaseDate: new Date('2023-06-01'),
      images: ['test2.jpg'],
      systemRequirements: {
        minimum: 'Test minimum requirements 2',
        recommended: 'Test recommended requirements 2',
      },
      available: true,
    },
    {
      title: 'Unavailable Test Game',
      description: 'A test game that is not available',
      shortDescription: 'Unavailable game',
      price: 19.99,
      currency: 'RUB',
      genre: 'Strategy',
      developer: 'Test Studio 3',
      publisher: 'Test Publisher 3',
      releaseDate: new Date('2023-12-01'),
      images: ['test3.jpg'],
      systemRequirements: {
        minimum: 'Test minimum requirements 3',
        recommended: 'Test recommended requirements 3',
      },
      available: false,
    },
  ];

  const savedGames = await gameRepository.save(testGames);
  console.log(`Seeded ${savedGames.length} test games`);
  return savedGames;
};

// Global test setup and teardown
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
});
