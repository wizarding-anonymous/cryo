import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { AchievementController } from './achievement.controller';
import { ProgressController } from './progress.controller';
import { AchievementService } from '../services/achievement.service';
import { ProgressService } from '../services/progress.service';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('Controllers Integration', () => {
    let app: INestApplication;

    const mockAchievementService = {
        getAllAchievements: jest.fn().mockResolvedValue([]),
        getUserAchievements: jest.fn().mockResolvedValue({
            achievements: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
        }),
        unlockAchievement: jest.fn().mockResolvedValue({}),
    };

    const mockProgressService = {
        getUserProgress: jest.fn().mockResolvedValue([]),
        updateProgress: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AchievementController, ProgressController],
            providers: [
                {
                    provide: AchievementService,
                    useValue: mockAchievementService,
                },
                {
                    provide: ProgressService,
                    useValue: mockProgressService,
                },
                {
                    provide: APP_GUARD,
                    useClass: JwtAuthGuard,
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Apply global pipes and filters like in main.ts
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        app.useGlobalFilters(new AllExceptionsFilter());

        await app.init();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('/achievements (GET)', () => {
        it('should return 401 without authorization header', () => {
            return request(app.getHttpServer())
                .get('/achievements')
                .expect(401)
                .expect((res) => {
                    expect(res.body.message).toBe('JWT token is required');
                });
        });

        it('should return 401 with invalid token', () => {
            return request(app.getHttpServer())
                .get('/achievements')
                .set('Authorization', 'Bearer invalid')
                .expect(401)
                .expect((res) => {
                    expect(res.body.message).toBe('Invalid JWT token');
                });
        });

        it('should return achievements with valid token', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .get('/achievements')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });
    });

    describe('/achievements/user/:userId (GET)', () => {
        it('should return user achievements with valid token', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .get('/achievements/user/user-123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('achievements');
                    expect(res.body).toHaveProperty('total');
                    expect(res.body).toHaveProperty('page');
                    expect(res.body).toHaveProperty('limit');
                    expect(res.body).toHaveProperty('totalPages');
                    expect(Array.isArray(res.body.achievements)).toBe(true);
                });
        });
    });

    describe('/achievements/unlock (POST)', () => {
        it('should return 400 for invalid request body', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .post('/achievements/unlock')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ invalidField: 'value' })
                .expect(400);
        });

        it('should process valid unlock request', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .post('/achievements/unlock')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    userId: '550e8400-e29b-41d4-a716-446655440000',
                    achievementId: '550e8400-e29b-41d4-a716-446655440001'
                })
                .expect((res) => {
                    // Should either succeed (201) or fail with business logic error (404, 409)
                    expect([201, 404, 409]).toContain(res.status);
                });
        });
    });

    describe('/progress/user/:userId (GET)', () => {
        it('should return user progress with valid token', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .get('/progress/user/user-123')
                .set('Authorization', `Bearer ${validToken}`)
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });
    });

    describe('/progress/update (POST)', () => {
        it('should return 400 for invalid request body', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .post('/progress/update')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ invalidField: 'value' })
                .expect(400);
        });

        it('should process valid progress update', () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            return request(app.getHttpServer())
                .post('/progress/update')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    userId: '550e8400-e29b-41d4-a716-446655440000',
                    eventType: 'game_purchase',
                    eventData: { gameId: 'game-456' }
                })
                .expect(200)
                .expect((res) => {
                    expect(Array.isArray(res.body)).toBe(true);
                });
        });
    });
});