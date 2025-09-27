import { Test } from '@nestjs/testing';

// Global test setup for integration tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
  process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
  process.env.DATABASE_USERNAME = process.env.DATABASE_USERNAME || 'social_user';
  process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'social_password';
  process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'social_test_db';
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'test-internal-token';
  
  // Service URLs for integration testing
  process.env.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  process.env.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
  process.env.ACHIEVEMENT_SERVICE_URL = process.env.ACHIEVEMENT_SERVICE_URL || 'http://localhost:3005';
  process.env.REVIEW_SERVICE_URL = process.env.REVIEW_SERVICE_URL || 'http://localhost:3006';
});

// Increase timeout for integration tests
jest.setTimeout(60000);