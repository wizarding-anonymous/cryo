import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Service Health', () => {
    it('GET / should return service information', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toContain('Auth Service');
        });
    });

    it('GET /health/ready should return ready status', () => {
      return request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('ready');
        });
    });

    it('GET /health/live should return alive status', () => {
      return request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('alive');
        });
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /auth/register', () => {
      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            // Missing name and password
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Имя не может быть пустым');
          });
      });

      it('should validate email format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: 'invalid-email',
            password: 'StrongPass123!',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Некорректный формат email');
          });
      });

      it('should validate password strength', () => {
        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: 'test@example.com',
            password: 'weak',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Пароль должен содержать не менее 8 символов');
          });
      });
    });

    describe('POST /auth/login', () => {
      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            // Missing password
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Пароль не может быть пустым');
          });
      });

      it('should validate email format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'password123',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Некорректный формат email');
          });
      });
    });

    describe('POST /auth/validate', () => {
      it('should validate token format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/validate')
          .send({
            // Missing token
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Токен не может быть пустым');
          });
      });
    });

    describe('POST /auth/refresh', () => {
      it('should validate refresh token format', () => {
        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({
            // Missing refreshToken
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Refresh токен не может быть пустым');
          });
      });
    });
  });
});