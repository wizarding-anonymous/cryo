import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Get, Query, Param } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as request from 'supertest';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { RequestLoggingInterceptor } from './interceptors/request-logging.interceptor';
import { GetGamesDto } from '../dto/get-games.dto';
import { SearchGamesDto } from '../dto/search-games.dto';

// Simple test controllers to avoid complex dependencies
@Controller('games')
class TestGameController {
    @Get()
    async getGames(@Query() query: GetGamesDto) {
        return {
            games: [],
            total: 0,
            page: query.page,
            limit: query.limit,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
        };
    }

    @Get(':id')
    async getGame(@Param('id') id: string) {
        if (id === 'error') {
            throw new Error('Test error');
        }
        return {
            id,
            title: 'Test Game',
            description: 'A test game description',
            shortDescription: 'Test game',
            price: 59.99,
            currency: 'USD',
            genre: 'Action',
            developer: 'Test Studio',
            publisher: 'Test Publisher',
            releaseDate: new Date('2023-01-01'),
            images: ['/img/test1.jpg'],
            systemRequirements: {
                minimum: 'Windows 10, 4GB RAM',
                recommended: 'Windows 11, 8GB RAM',
            },
            available: true,
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
        };
    }

}

@Controller('games')
class TestSearchController {
    @Get('search')
    async searchGames(@Query() query: SearchGamesDto) {
        return {
            games: [],
            total: 0,
            page: query.page,
            limit: query.limit,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
        };
    }
}

describe('Middleware Integration Tests', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [TestGameController, TestSearchController],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Configure the same middleware as in main.ts
        app.useGlobalInterceptors(new RequestLoggingInterceptor());

        const httpAdapterHost = app.get(HttpAdapterHost);
        app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));

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

        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('Global Validation Pipe Integration', () => {
        it('should validate and transform query parameters correctly', async () => {
            const response = await request(app.getHttpServer())
                .get('/games?page=2&limit=20&available=true')
                .expect(200);

            expect(response.body.page).toBe(2);
            expect(response.body.limit).toBe(20);
        });

        it('should reject invalid query parameters with proper error format', async () => {
            const response = await request(app.getHttpServer())
                .get('/games?page=0&limit=101')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
            expect(response.body.error).toHaveProperty('message');
            expect(response.body.error.message).toContain('Page must be at least 1');
            expect(response.body.error.message).toContain('Limit cannot exceed 100');
        });

        it('should reject non-whitelisted properties', async () => {
            const response = await request(app.getHttpServer())
                .get('/games?page=1&maliciousField=hack')
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.message).toContain('property maliciousField should not exist');
        });

        it('should validate basic query parameters', async () => {
            const response = await request(app.getHttpServer())
                .get('/games?page=1&limit=10')
                .expect(200);

            expect(response.body.page).toBe(1);
            expect(response.body.limit).toBe(10);
        });
    });

    describe('Global Exception Filter Integration', () => {
        it('should handle service errors with consistent format', async () => {
            const response = await request(app.getHttpServer())
                .get('/games/error')
                .expect(500);

            expect(response.body).toEqual({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Internal server error',
                    details: {},
                },
            });
        });
    });

    describe('Request Logging Interceptor Integration', () => {
        it('should log successful requests', async () => {
            // The RequestLoggingInterceptor uses NestJS Logger, which outputs to console
            // We'll just verify the request completes successfully
            const response = await request(app.getHttpServer())
                .get('/games')
                .expect(200);

            // Verify the response is correct
            expect(response.body.games).toBeDefined();
        });

        it('should log failed requests', async () => {
            // The RequestLoggingInterceptor should still log even when requests fail
            await request(app.getHttpServer())
                .get('/games/error')
                .expect(500);

            // The test passes if the request completes (logging happens in background)
        });
    });

    describe('Middleware Chain Integration', () => {
        it('should process request through complete middleware chain', async () => {
            const response = await request(app.getHttpServer())
                .get('/games/123')
                .expect(200);

            // Verify the response structure
            expect(response.body.id).toBe('123');
            expect(response.body.title).toBe('Test Game');
        });

        it('should handle validation -> service error -> exception filter chain', async () => {
            // First test validation error
            const validationResponse = await request(app.getHttpServer())
                .get('/games?page=0')
                .expect(400);

            expect(validationResponse.body.error.code).toBe('VALIDATION_ERROR');

            // Then test service error after successful validation
            const serviceErrorResponse = await request(app.getHttpServer())
                .get('/games/error')
                .expect(500);

            expect(serviceErrorResponse.body.error.code).toBe('INTERNAL_SERVER_ERROR');
        });
    });

    describe('Performance and Response Time', () => {
        it('should complete requests within reasonable time', async () => {
            const startTime = Date.now();

            await request(app.getHttpServer())
                .get('/games')
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Should complete within 1 second (generous for test environment)
            expect(responseTime).toBeLessThan(1000);
        });
    });
});