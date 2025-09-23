import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import { ExternalIntegrationService } from './external-integration.service';
import { Review } from '../entities/review.entity';
import { ExternalServiceError } from './external-service.base';

describe('ExternalIntegrationService', () => {
    let service: ExternalIntegrationService;
    let httpService: jest.Mocked<HttpService>;
    let configService: jest.Mocked<ConfigService>;

    const mockReview: Review = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        gameId: 'game-456',
        text: 'Great game!',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const mockHttpService = {
            request: jest.fn(),
        };

        const mockConfigService = {
            get: jest.fn((key: string) => {
                const config = {
                    'app.services.achievement': 'http://achievement-service',
                    'app.services.notification': 'http://notification-service',
                    'app.services.gameCatalog': 'http://game-catalog-service',
                    'app.services.library': 'http://library-service',
                };
                return config[key];
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExternalIntegrationService,
                {
                    provide: HttpService,
                    useValue: mockHttpService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<ExternalIntegrationService>(ExternalIntegrationService);
        httpService = module.get(HttpService);
        configService = module.get(ConfigService);

        // Configuration is already set up in mockConfigService above

        // Mock delay method to speed up tests
        jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('notifyFirstReviewAchievement', () => {
        it('should notify achievement service successfully', async () => {
            httpService.request.mockReturnValue(of({
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            await service.notifyFirstReviewAchievement('user-123');

            expect(httpService.request).toHaveBeenCalledWith({
                url: 'http://achievement-service/api/v1/achievements/unlock',
                method: 'POST',
                data: expect.objectContaining({
                    userId: 'user-123',
                    achievementType: 'FIRST_REVIEW',
                    timestamp: expect.any(String),
                    metadata: { source: 'review-service' },
                }),
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('should handle achievement service errors gracefully', async () => {
            const axiosError = {
                isAxiosError: true,
                response: { status: 500 },
            } as AxiosError;

            httpService.request.mockReturnValue(throwError(() => axiosError));

            // Should not throw error
            await expect(service.notifyFirstReviewAchievement('user-123')).resolves.toBeUndefined();
        });

        it('should retry on server errors', async () => {
            const serverError = {
                isAxiosError: true,
                response: { status: 503 },
            } as AxiosError;

            httpService.request
                .mockReturnValueOnce(throwError(() => serverError))
                .mockReturnValueOnce(throwError(() => serverError))
                .mockReturnValueOnce(throwError(() => serverError));

            // Mock delay to speed up test
            jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

            try {
                await service.notifyFirstReviewAchievement('user-123');
            } catch (error) {
                // Expected to fail after retries
            }

            expect(httpService.request).toHaveBeenCalledTimes(2);
        });
    });

    describe('notifyReviewAction', () => {
        it('should notify notification service about review creation', async () => {
            httpService.request.mockReturnValue(of({
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            await service.notifyReviewAction(mockReview, 'created');

            expect(httpService.request).toHaveBeenCalledWith({
                url: 'http://notification-service/api/v1/notifications/review-action',
                method: 'POST',
                data: expect.objectContaining({
                    reviewId: mockReview.id,
                    userId: mockReview.userId,
                    gameId: mockReview.gameId,
                    rating: mockReview.rating,
                    action: 'created',
                    timestamp: expect.any(String),
                }),
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('should handle different review actions', async () => {
            httpService.request.mockReturnValue(of({
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            const actions: Array<'created' | 'updated' | 'deleted'> = ['created', 'updated', 'deleted'];

            for (const action of actions) {
                await service.notifyReviewAction(mockReview, action);

                expect(httpService.request).toHaveBeenCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({ action }),
                    })
                );
            }

            expect(httpService.request).toHaveBeenCalledTimes(3);
        });

        it('should handle notification service errors gracefully', async () => {
            httpService.request.mockReturnValue(throwError(() => new Error('Network error')));

            // Should not throw error
            await expect(service.notifyReviewAction(mockReview, 'updated')).resolves.toBeUndefined();
        });
    });

    describe('updateGameCatalogRating', () => {
        it('should update game catalog rating successfully', async () => {
            httpService.request.mockReturnValue(of({
                data: { success: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            await service.updateGameCatalogRating('game-456', 4.5, 10);

            expect(httpService.request).toHaveBeenCalledWith({
                url: 'http://game-catalog-service/api/v1/games/game-456/rating',
                method: 'PUT',
                data: expect.objectContaining({
                    gameId: 'game-456',
                    averageRating: 4.5,
                    totalReviews: 10,
                    timestamp: expect.any(String),
                }),
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('should retry on server errors', async () => {
            const serverError = {
                isAxiosError: true,
                response: { status: 500 },
            } as AxiosError;

            httpService.request
                .mockReturnValueOnce(throwError(() => serverError))
                .mockReturnValueOnce(throwError(() => serverError))
                .mockReturnValueOnce(of({
                    data: { success: true },
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: {} as any,
                }));

            await service.updateGameCatalogRating('game-456', 4.5, 10);

            expect(httpService.request).toHaveBeenCalledTimes(3);
        });

        it('should throw error on non-retryable failures', async () => {
            const clientError = {
                message: 'Bad Request',
                name: 'AxiosError',
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: {},
                    headers: {},
                    config: {} as any,
                },
                isAxiosError: true,
            } as AxiosError;

            httpService.request.mockReturnValue(throwError(() => clientError));

            await expect(service.updateGameCatalogRating('game-456', 4.5, 10))
                .rejects.toThrow(ExternalServiceError);
        });
    });

    describe('validateGameExists', () => {
        it('should return true when game exists', async () => {
            httpService.request.mockReturnValue(of({
                data: null,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            const result = await service.validateGameExists('game-456');

            expect(result).toBe(true);
            expect(httpService.request).toHaveBeenCalledWith({
                url: 'http://game-catalog-service/api/v1/games/game-456',
                method: 'HEAD',
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('should return false when game does not exist', async () => {
            const notFoundError = {
                message: 'Not Found',
                name: 'AxiosError',
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    data: {},
                    headers: {},
                    config: {} as any,
                },
                isAxiosError: true,
            } as AxiosError;

            httpService.request.mockReturnValue(throwError(() => notFoundError));

            const result = await service.validateGameExists('nonexistent-game');

            expect(result).toBe(false);
        });

        it('should return true on service errors (fail-safe)', async () => {
            httpService.request.mockReturnValue(throwError(() => new Error('Service unavailable')));

            const result = await service.validateGameExists('game-456');

            expect(result).toBe(true);
        });
    });

    describe('getGameInfo', () => {
        it('should return game information successfully', async () => {
            const gameInfo = {
                id: 'game-456',
                title: 'Test Game',
                description: 'A test game',
            };

            httpService.request.mockReturnValue(of({
                data: gameInfo,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            const result = await service.getGameInfo('game-456');

            expect(result).toEqual({
                title: 'Test Game',
                description: 'A test game',
            });
        });

        it('should return null on errors', async () => {
            httpService.request.mockReturnValue(throwError(() => new Error('Service error')));

            const result = await service.getGameInfo('game-456');

            expect(result).toBeNull();
        });
    });

    describe('healthCheck', () => {
        it('should check health of all services', async () => {
            httpService.request.mockReturnValue(of({
                data: { status: 'ok' },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            }));

            const result = await service.healthCheck();

            expect(result).toEqual({
                library: true,
                gameCatalog: true,
                achievement: true,
                notification: true,
            });

            expect(httpService.request).toHaveBeenCalledTimes(4);
        });

        it('should handle individual service failures', async () => {
            httpService.request
                .mockReturnValueOnce(of({ data: { status: 'ok' }, status: 200, statusText: 'OK', headers: {}, config: {} as any }))
                .mockReturnValueOnce(throwError(() => new Error('Service down')))
                .mockReturnValueOnce(of({ data: { status: 'ok' }, status: 200, statusText: 'OK', headers: {}, config: {} as any }))
                .mockReturnValueOnce(throwError(() => new Error('Service down')));

            const result = await service.healthCheck();

            expect(result).toEqual({
                library: true,
                gameCatalog: false,
                achievement: true,
                notification: false,
            });
        });
    });
});