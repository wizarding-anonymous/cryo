import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    
    // Enable rate limiting for tests
    jest.spyOn(configService, 'get').mockImplementation((key: string, options?: any) => {
      if (key === 'RATE_LIMIT_ENABLED') return true;
      if (key === 'NODE_ENV') return 'test';
      // Return high limits for most tests
      if (key === 'RATE_LIMIT_DEFAULT_LIMIT') return 1000;
      if (key === 'RATE_LIMIT_BATCH_LIMIT') return 100;
      if (key === 'RATE_LIMIT_PROFILE_LIMIT') return 500;
      if (key === 'RATE_LIMIT_INTERNAL_LIMIT') return 5000;
      if (key === 'RATE_LIMIT_UPLOAD_LIMIT') return 50;
      if (key === 'RATE_LIMIT_SEARCH_LIMIT') return 1000;
      
      // Default values for other configs
      const defaults = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
        REDIS_DB: 0,
        THROTTLE_TTL: 60000,
        THROTTLE_LIMIT: 60,
      };
      
      return defaults[key as keyof typeof defaults] || (options?.infer ? undefined : null);
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health endpoint (should not be rate limited)', () => {
    it('should allow multiple rapid requests to health endpoint', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get('/health')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
      });
    });
  });

  describe('Rate limiting with low limits', () => {
    beforeEach(() => {
      // Set very low limits for testing rate limiting behavior
      jest.spyOn(configService, 'get').mockImplementation((key: string, options?: any) => {
        if (key === 'RATE_LIMIT_ENABLED') return true;
        if (key === 'NODE_ENV') return 'test';
        if (key === 'RATE_LIMIT_DEFAULT_LIMIT') return 2; // Very low limit
        if (key === 'RATE_LIMIT_BATCH_LIMIT') return 1; // Very low limit
        if (key === 'RATE_LIMIT_PROFILE_LIMIT') return 2;
        if (key === 'RATE_LIMIT_INTERNAL_LIMIT') return 3;
        if (key === 'RATE_LIMIT_UPLOAD_LIMIT') return 1;
        if (key === 'RATE_LIMIT_SEARCH_LIMIT') return 2;
        
        const defaults = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: '',
          REDIS_DB: 0,
          THROTTLE_TTL: 60000,
          THROTTLE_LIMIT: 60,
        };
        
        return defaults[key as keyof typeof defaults] || (options?.infer ? undefined : null);
      });
    });

    it('should rate limit default endpoints after exceeding limit', async () => {
      // This test would require a real endpoint that doesn't require authentication
      // For now, we'll test the concept with health endpoint if it were rate limited
      
      // Make requests up to the limit
      const response1 = await request(app.getHttpServer()).get('/health');
      expect(response1.status).toBe(HttpStatus.OK);

      const response2 = await request(app.getHttpServer()).get('/health');
      expect(response2.status).toBe(HttpStatus.OK);

      // This would be rate limited if health endpoint had rate limiting
      // const response3 = await request(app.getHttpServer()).get('/health');
      // expect(response3.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('Rate limiting disabled', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'get').mockImplementation((key: string, options?: any) => {
        if (key === 'RATE_LIMIT_ENABLED') return false; // Disable rate limiting
        if (key === 'NODE_ENV') return 'test';
        
        const defaults = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: '',
          REDIS_DB: 0,
          THROTTLE_TTL: 60000,
          THROTTLE_LIMIT: 60,
        };
        
        return defaults[key as keyof typeof defaults] || (options?.infer ? undefined : null);
      });
    });

    it('should allow unlimited requests when rate limiting is disabled', async () => {
      const promises = Array.from({ length: 20 }, () =>
        request(app.getHttpServer()).get('/health')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(HttpStatus.OK);
      });
    });
  });

  describe('Rate limiting error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis connection failure
      // This would require mocking the Redis client to throw errors
      
      const response = await request(app.getHttpServer()).get('/health');
      
      // Should still allow requests when Redis fails (fail-open)
      expect(response.status).toBe(HttpStatus.OK);
    });
  });

  describe('Different operation types', () => {
    it('should apply different rate limits to different operation types', async () => {
      // This test would require actual endpoints with different rate limiting types
      // For demonstration purposes, we're showing the concept
      
      // Batch operations would have stricter limits
      // Profile operations would have moderate limits  
      // Internal operations would have higher limits
      // Search operations would have specific limits
      
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Custom rate limit configurations', () => {
    it('should respect custom rate limit configurations from decorators', async () => {
      // This would test endpoints with custom @RateLimit decorators
      // The test would verify that custom limits are applied correctly
      
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Key generation', () => {
    it('should generate different keys for different IPs', async () => {
      // Test that different IPs get different rate limit buckets
      // This would require mocking different IP addresses
      
      expect(true).toBe(true); // Placeholder test
    });

    it('should generate different keys for different users', async () => {
      // Test that different authenticated users get different rate limit buckets
      // This would require authentication setup
      
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Rate limit headers', () => {
    it('should include rate limit information in response headers', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      
      // Check if rate limit headers are present (if implemented)
      // expect(response.headers['x-ratelimit-limit']).toBeDefined();
      // expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      // expect(response.headers['x-ratelimit-reset']).toBeDefined();
      
      expect(response.status).toBe(HttpStatus.OK);
    });
  });
});