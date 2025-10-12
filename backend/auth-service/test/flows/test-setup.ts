import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  redis: Redis;
  configService: ConfigService;
  testUsers: any[];
  testSessions: any[];
  testTokens: string[];
}

export class AuthFlowTestSetup {
  static async createTestApp(): Promise<TestContext> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    app.setGlobalPrefix('api');
    
    // Get services for cleanup and verification
    const dataSource = app.get(DataSource);
    const configService = app.get(ConfigService);
    
    // Initialize Redis connection for shared cache verification
    const redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
    
    await app.init();
    
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      app,
      dataSource,
      redis,
      configService,
      testUsers: [],
      testSessions: [],
      testTokens: [],
    };
  }

  static async cleanupTestData(context: TestContext) {
    try {
      // Clean up sessions
      if (context.testSessions.length > 0) {
        await context.dataSource.query(
          'DELETE FROM sessions WHERE id = ANY($1)',
          [context.testSessions.map(s => s.id)]
        );
      }

      // Clean up token blacklist
      if (context.testTokens.length > 0) {
        const tokenHashes = context.testTokens.map(token => 
          createHash('sha256').update(token).digest('hex')
        );
        await context.dataSource.query(
          'DELETE FROM token_blacklist WHERE token_hash = ANY($1)',
          [tokenHashes]
        );
        
        // Clean up Redis blacklist
        for (const token of context.testTokens) {
          await context.redis.del(`blacklist:${token}`);
        }
      }
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error.message);
    }
  }

  static async closeTestApp(context: TestContext) {
    await this.cleanupTestData(context);
    
    if (context.redis) {
      await context.redis.disconnect();
    }
    
    if (context.app) {
      await context.app.close();
    }
  }

  static generateTestEmail(): string {
    return `test-${randomBytes(8).toString('hex')}@example.com`;
  }

  static generateTestPassword(): string {
    return `TestPass${randomBytes(4).toString('hex')}!`;
  }

  static clearTestData(context: TestContext) {
    context.testUsers.length = 0;
    context.testSessions.length = 0;
    context.testTokens.length = 0;
  }

  static async createTestUser(context: TestContext, userData?: Partial<any>) {
    const testEmail = userData?.email || this.generateTestEmail();
    const testPassword = userData?.password || this.generateTestPassword();
    const registrationData = {
      name: userData?.name || 'Test User',
      email: testEmail,
      password: testPassword,
    };

    const response = await fetch(`http://localhost:${context.app.getHttpServer().address()?.port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData),
    });

    if (response.ok) {
      const result = await response.json();
      context.testUsers.push(result.user);
      context.testSessions.push({ id: result.session_id });
      context.testTokens.push(result.access_token, result.refresh_token);
      return { ...result, password: testPassword };
    }

    throw new Error(`Failed to create test user: ${response.statusText}`);
  }
}