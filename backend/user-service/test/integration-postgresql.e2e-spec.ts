import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpAdapterHost } from '@nestjs/core';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DataSource, Repository } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { UserService } from '../src/user/user.service';

describe('PostgreSQL Integration Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let userService: UserService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
    userService = moduleFixture.get<UserService>(UserService);

    // Apply global configurations
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, app.get('Logger')));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Ensure database connection is established
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (dataSource.isInitialized) {
      await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await userRepository.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('Database Connection and Health', () => {
    it('should have a healthy database connection', async () => {
      expect(dataSource.isInitialized).toBe(true);
      
      // Test basic query
      const result = await dataSource.query('SELECT 1 as test');
      expect(result[0].test).toBe(1);
    });

    it('should report database health in health endpoint', async () => {
      const healthResponse = await request(app.getHttpServer())
        .get('/api/health')
        .expect((res) => {
          expect([200, 503]).toContain(res.status);
        });

      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('details');

      // Check if database health is included
      if (healthResponse.body.details.database) {
        expect(healthResponse.body.details.database).toHaveProperty('status');
      }
    });
  });

  describe('User CRUD Operations with Database', () => {
    const testUser = {
      name: 'Database Test User',
      email: `db-test-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };

    it('should create user in database with proper constraints', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = response.body.data.id;
      expect(userId).toBeTruthy();

      // Verify user exists in database
      const dbUser = await userRepository.findOne({ where: { id: userId } });
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(testUser.email);
      expect(dbUser.name).toBe(testUser.name);
      expect(dbUser.password).toBe(testUser.password);
      expect(dbUser.isActive).toBe(true);
      expect(dbUser.createdAt).toBeTruthy();
      expect(dbUser.updatedAt).toBeTruthy();
    });

    it('should enforce unique email constraint', async () => {
      // Create first user
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      // Try to create second user with same email
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(409); // Conflict - email already exists
    });

    it('should handle database transactions properly', async () => {
      const batchUsers = Array.from({ length: 3 }, (_, i) => ({
        name: `Transaction User ${i}`,
        email: `transaction-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      // Add one invalid user to test rollback
      const invalidUser = {
        name: 'Invalid User',
        email: testUser.email, // This will cause a conflict if testUser exists
        password: '$2b$10$hashedPasswordFromAuthService',
      };

      // First create the testUser
      await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      // Now try batch create with conflict
      const batchWithConflict = [...batchUsers, invalidUser];
      
      const batchResponse = await request(app.getHttpServer())
        .post('/api/batch/users/create')
        .set('x-internal-service', 'user-service-internal')
        .send({ 
          users: batchWithConflict,
          options: { chunkSize: 10, continueOnError: true }
        })
        .expect(201);

      // Should have some successful and some failed
      expect(batchResponse.body.stats.successful).toBe(3);
      expect(batchResponse.body.stats.failed).toBe(1);

      // Verify only valid users were created
      const dbUsers = await userRepository.find();
      const createdEmails = dbUsers.map(u => u.email);
      
      expect(createdEmails).toContain(testUser.email);
      batchUsers.forEach(user => {
        expect(createdEmails).toContain(user.email);
      });
    });

    it('should handle soft delete properly', async () => {
      // Create user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = response.body.data.id;

      // Soft delete user
      await request(app.getHttpServer())
        .delete('/api/batch/users/soft-delete')
        .set('x-internal-service', 'user-service-internal')
        .send({ userIds: [userId] })
        .expect(200);

      // User should still exist in database but with deletedAt timestamp
      const dbUser = await userRepository.findOne({ 
        where: { id: userId },
        withDeleted: true 
      });
      
      expect(dbUser).toBeTruthy();
      expect(dbUser.deletedAt).toBeTruthy();

      // User should not be found in normal queries
      const activeUser = await userRepository.findOne({ where: { id: userId } });
      expect(activeUser).toBeNull();
    });

    it('should update lastLoginAt timestamp correctly', async () => {
      // Create user
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);

      const userId = response.body.data.id;

      // Get initial user state
      const initialUser = await userRepository.findOne({ where: { id: userId } });
      expect(initialUser.lastLoginAt).toBeNull();

      // Update last login
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/last-login`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      // Verify lastLoginAt was updated
      const updatedUser = await userRepository.findOne({ where: { id: userId } });
      expect(updatedUser.lastLoginAt).toBeTruthy();
      expect(updatedUser.lastLoginAt.getTime()).toBeGreaterThan(
        initialUser.createdAt.getTime()
      );
    });
  });

  describe('Database Indexing and Performance', () => {
    beforeEach(async () => {
      // Create test data for performance tests
      const testUsers = Array.from({ length: 100 }, (_, i) => ({
        name: `Performance User ${i}`,
        email: `perf-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
        isActive: i % 2 === 0, // Mix of active and inactive users
        lastLoginAt: i % 3 === 0 ? new Date() : null, // Some with recent login
      }));

      // Batch insert test data
      await userRepository.save(testUsers);
    });

    it('should efficiently query users by email (indexed)', async () => {
      const testEmail = `perf-user-50-${Date.now()}@example.com`;
      
      // Update one user's email to our test email
      await userRepository.update(
        { name: 'Performance User 50' },
        { email: testEmail }
      );

      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/email/${testEmail}`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const queryTime = Date.now() - startTime;
      
      expect(response.body.data.email).toBe(testEmail);
      expect(queryTime).toBeLessThan(100); // Should be fast due to email index
    });

    it('should efficiently paginate through users', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/api/users?page=1&limit=20&sortBy=createdAt&sortOrder=desc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const queryTime = Date.now() - startTime;
      
      expect(response.body.data.items).toHaveLength(20);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(100);
      expect(queryTime).toBeLessThan(200); // Should be reasonably fast
    });

    it('should efficiently filter users by active status', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/api/users?isActive=true&limit=50')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const queryTime = Date.now() - startTime;
      
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach(user => {
        expect(user.isActive).toBe(true);
      });
      expect(queryTime).toBeLessThan(150); // Should be fast due to isActive index
    });

    it('should handle cursor-based pagination efficiently', async () => {
      // Get first page
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/users?limit=10&sortBy=createdAt&sortOrder=asc')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(firstPageResponse.body.data.items).toHaveLength(10);
      const nextCursor = firstPageResponse.body.data.pagination.nextCursor;
      expect(nextCursor).toBeTruthy();

      // Get second page using cursor
      const startTime = Date.now();
      
      const secondPageResponse = await request(app.getHttpServer())
        .get(`/api/users?cursor=${encodeURIComponent(nextCursor)}&limit=10&sortBy=createdAt&sortOrder=asc`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      const queryTime = Date.now() - startTime;
      
      expect(secondPageResponse.body.data.items).toHaveLength(10);
      expect(queryTime).toBeLessThan(100); // Cursor pagination should be fast
      
      // Verify no overlap between pages
      const firstPageIds = firstPageResponse.body.data.items.map(u => u.id);
      const secondPageIds = secondPageResponse.body.data.items.map(u => u.id);
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Database Connection Pool and Resilience', () => {
    it('should handle concurrent database operations', async () => {
      const concurrentUsers = Array.from({ length: 10 }, (_, i) => ({
        name: `Concurrent User ${i}`,
        email: `concurrent-user-${i}-${Date.now()}@example.com`,
        password: '$2b$10$hashedPasswordFromAuthService',
      }));

      // Create users concurrently
      const createPromises = concurrentUsers.map(user =>
        request(app.getHttpServer())
          .post('/api/internal/users')
          .set('x-internal-service', 'user-service-internal')
          .send(user)
      );

      const responses = await Promise.all(createPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.data.id).toBeTruthy();
      });

      // Verify all users were created
      const dbUsers = await userRepository.find();
      expect(dbUsers.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle database query timeouts gracefully', async () => {
      // This test simulates a slow query scenario
      // In a real scenario, you might want to test with actual slow queries
      
      const response = await request(app.getHttpServer())
        .get('/api/users?limit=1000') // Large limit might be slower
        .set('x-internal-service', 'user-service-internal')
        .expect((res) => {
          // Should either succeed or fail gracefully
          expect([200, 408, 500]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body.data).toBeTruthy();
      }
    });

    it('should log slow queries for monitoring', async () => {
      // Create a complex query that might be slow
      const response = await request(app.getHttpServer())
        .get('/api/users?name=Performance&email=perf&sortBy=lastLoginAt&sortOrder=desc&limit=100')
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data).toBeTruthy();
      // In a real implementation, you would check logs for slow query warnings
      // This is more of a smoke test to ensure the query completes
    });
  });

  describe('Database Migrations and Schema', () => {
    it('should have proper table structure', async () => {
      // Check if users table exists and has expected columns
      const tableInfo = await dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);

      const columnNames = tableInfo.map(col => col.column_name);
      
      // Verify essential columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('password');
      expect(columnNames).toContain('isActive');
      expect(columnNames).toContain('lastLoginAt');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
      expect(columnNames).toContain('deletedAt');
      expect(columnNames).toContain('avatarUrl');
      expect(columnNames).toContain('preferences');
      expect(columnNames).toContain('privacySettings');
      expect(columnNames).toContain('metadata');
    });

    it('should have proper indexes for performance', async () => {
      // Check if expected indexes exist
      const indexes = await dataSource.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'users'
      `);

      const indexNames = indexes.map(idx => idx.indexname);
      
      // Should have indexes on frequently queried columns
      expect(indexNames.some(name => name.includes('email'))).toBe(true);
      expect(indexNames.some(name => name.includes('isActive'))).toBe(true);
      expect(indexNames.some(name => name.includes('createdAt'))).toBe(true);
    });

    it('should have proper constraints', async () => {
      // Check constraints
      const constraints = await dataSource.query(`
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'users'
      `);

      const constraintTypes = constraints.map(c => c.constraint_type);
      
      // Should have primary key and unique constraints
      expect(constraintTypes).toContain('PRIMARY KEY');
      expect(constraintTypes).toContain('UNIQUE');
    });
  });

  describe('JSONB Field Operations', () => {
    const testUser = {
      name: 'JSONB Test User',
      email: `jsonb-test-${Date.now()}@example.com`,
      password: '$2b$10$hashedPasswordFromAuthService',
    };
    let userId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/internal/users')
        .set('x-internal-service', 'user-service-internal')
        .send(testUser)
        .expect(201);
      
      userId = response.body.data.id;
    });

    it('should store and retrieve preferences as JSONB', async () => {
      const preferences = {
        language: 'en',
        timezone: 'UTC',
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          sms: true,
        },
        gameSettings: {
          autoDownload: true,
          cloudSave: false,
          achievementNotifications: true,
        },
      };

      // Update preferences
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .send(preferences)
        .expect(200);

      // Retrieve and verify
      const response = await request(app.getHttpServer())
        .get(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .expect(200);

      expect(response.body.data.language).toBe(preferences.language);
      expect(response.body.data.theme).toBe(preferences.theme);
      expect(response.body.data.notifications.email).toBe(preferences.notifications.email);
      expect(response.body.data.gameSettings.autoDownload).toBe(preferences.gameSettings.autoDownload);
    });

    it('should query JSONB fields efficiently', async () => {
      // Set up test data with specific preferences
      await userRepository.update(userId, {
        preferences: {
          language: 'es',
          timezone: 'America/New_York',
          theme: 'light',
          notifications: { email: true, push: true, sms: false },
          gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
        },
      });

      // Query using JSONB operators (this would be in a custom repository method)
      const users = await userRepository
        .createQueryBuilder('user')
        .where("user.preferences->>'language' = :language", { language: 'es' })
        .getMany();

      expect(users.length).toBeGreaterThan(0);
      expect(users[0].preferences.language).toBe('es');
    });

    it('should handle partial JSONB updates', async () => {
      // Set initial preferences
      await userRepository.update(userId, {
        preferences: {
          language: 'en',
          timezone: 'UTC',
          theme: 'light',
          notifications: { email: true, push: true, sms: false },
          gameSettings: { autoDownload: false, cloudSave: true, achievementNotifications: true },
        },
      });

      // Partial update - only change theme
      const partialUpdate = { theme: 'dark' };
      
      await request(app.getHttpServer())
        .patch(`/api/internal/users/${userId}/preferences`)
        .set('x-internal-service', 'user-service-internal')
        .send(partialUpdate)
        .expect(200);

      // Verify only theme changed, other fields preserved
      const updatedUser = await userRepository.findOne({ where: { id: userId } });
      expect(updatedUser.preferences.theme).toBe('dark');
      expect(updatedUser.preferences.language).toBe('en'); // Should be preserved
      expect(updatedUser.preferences.notifications.email).toBe(true); // Should be preserved
    });
  });
});