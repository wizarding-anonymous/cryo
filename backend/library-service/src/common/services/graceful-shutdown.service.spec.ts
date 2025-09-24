import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GracefulShutdownService, ShutdownHandler } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
    let service: GracefulShutdownService;
    let configService: ConfigService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GracefulShutdownService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue(30000), // Default shutdown timeout
                    },
                },
            ],
        }).compile();

        service = module.get<GracefulShutdownService>(GracefulShutdownService);
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        // Clean up any event listeners
        process.removeAllListeners('SIGTERM');
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should register shutdown handlers', () => {
        const handler: ShutdownHandler = {
            name: 'test-handler',
            handler: jest.fn().mockResolvedValue(undefined),
            timeout: 5000,
        };

        service.registerShutdownHandler(handler);

        expect(service['shutdownHandlers']).toContain(handler);
    });

    it('should return shutdown status', () => {
        expect(service.isShutdown()).toBe(false);

        // Simulate shutdown
        service['isShuttingDown'] = true;

        expect(service.isShutdown()).toBe(true);
    });

    it('should create database shutdown handler', () => {
        const mockDataSource = {
            isInitialized: true,
            destroy: jest.fn().mockResolvedValue(undefined),
        };

        const handler = GracefulShutdownService.createDatabaseShutdownHandler(mockDataSource);

        expect(handler.name).toBe('Database Connection');
        expect(handler.timeout).toBe(10000);
        expect(typeof handler.handler).toBe('function');
    });

    it('should create redis shutdown handler', () => {
        const mockRedisClient = {
            isOpen: true,
            quit: jest.fn().mockResolvedValue(undefined),
        };

        const handler = GracefulShutdownService.createRedisShutdownHandler(mockRedisClient);

        expect(handler.name).toBe('Redis Connection');
        expect(handler.timeout).toBe(5000);
        expect(typeof handler.handler).toBe('function');
    });

    it('should create HTTP server shutdown handler', () => {
        const mockServer = {
            close: jest.fn().mockImplementation((callback) => callback()),
        };

        const handler = GracefulShutdownService.createHttpServerShutdownHandler(mockServer);

        expect(handler.name).toBe('HTTP Server');
        expect(handler.timeout).toBe(15000);
        expect(typeof handler.handler).toBe('function');
    });

    it('should create Kafka shutdown handler', () => {
        const mockKafkaClient = {
            disconnect: jest.fn().mockResolvedValue(undefined),
        };

        const handler = GracefulShutdownService.createKafkaShutdownHandler(mockKafkaClient);

        expect(handler.name).toBe('Kafka Client');
        expect(handler.timeout).toBe(10000);
        expect(typeof handler.handler).toBe('function');
    });

    it('should create cache shutdown handler', () => {
        const mockCacheManager = {
            reset: jest.fn().mockResolvedValue(undefined),
        };

        const handler = GracefulShutdownService.createCacheShutdownHandler(mockCacheManager);

        expect(handler.name).toBe('Cache Manager');
        expect(handler.timeout).toBe(5000);
        expect(typeof handler.handler).toBe('function');
    });

    describe('shutdown handlers execution', () => {
        it('should execute database shutdown handler successfully', async () => {
            const mockDataSource = {
                isInitialized: true,
                destroy: jest.fn().mockResolvedValue(undefined),
            };

            const handler = GracefulShutdownService.createDatabaseShutdownHandler(mockDataSource);

            await handler.handler();

            expect(mockDataSource.destroy).toHaveBeenCalled();
        });

        it('should handle database shutdown when not initialized', async () => {
            const mockDataSource = {
                isInitialized: false,
                destroy: jest.fn(),
            };

            const handler = GracefulShutdownService.createDatabaseShutdownHandler(mockDataSource);

            await handler.handler();

            expect(mockDataSource.destroy).not.toHaveBeenCalled();
        });

        it('should execute redis shutdown handler successfully', async () => {
            const mockRedisClient = {
                isOpen: true,
                quit: jest.fn().mockResolvedValue(undefined),
            };

            const handler = GracefulShutdownService.createRedisShutdownHandler(mockRedisClient);

            await handler.handler();

            expect(mockRedisClient.quit).toHaveBeenCalled();
        });

        it('should handle redis shutdown when not open', async () => {
            const mockRedisClient = {
                isOpen: false,
                quit: jest.fn(),
            };

            const handler = GracefulShutdownService.createRedisShutdownHandler(mockRedisClient);

            await handler.handler();

            expect(mockRedisClient.quit).not.toHaveBeenCalled();
        });

        it('should execute HTTP server shutdown handler successfully', async () => {
            const mockServer = {
                close: jest.fn().mockImplementation((callback) => callback()),
            };

            const handler = GracefulShutdownService.createHttpServerShutdownHandler(mockServer);

            await handler.handler();

            expect(mockServer.close).toHaveBeenCalled();
        });

        it('should handle HTTP server shutdown error', async () => {
            const mockServer = {
                close: jest.fn().mockImplementation((callback) => callback(new Error('Server error'))),
            };

            const handler = GracefulShutdownService.createHttpServerShutdownHandler(mockServer);

            await expect(handler.handler()).rejects.toThrow('Server error');
        });

        it('should handle missing server in HTTP shutdown handler', async () => {
            const handler = GracefulShutdownService.createHttpServerShutdownHandler(null);

            await expect(handler.handler()).resolves.toBeUndefined();
        });

        it('should execute Kafka shutdown handler successfully', async () => {
            const mockKafkaClient = {
                disconnect: jest.fn().mockResolvedValue(undefined),
            };

            const handler = GracefulShutdownService.createKafkaShutdownHandler(mockKafkaClient);

            await handler.handler();

            expect(mockKafkaClient.disconnect).toHaveBeenCalled();
        });

        it('should handle missing Kafka client', async () => {
            const handler = GracefulShutdownService.createKafkaShutdownHandler(null);

            await expect(handler.handler()).resolves.toBeUndefined();
        });

        it('should execute cache shutdown handler successfully', async () => {
            const mockCacheManager = {
                reset: jest.fn().mockResolvedValue(undefined),
            };

            const handler = GracefulShutdownService.createCacheShutdownHandler(mockCacheManager);

            await handler.handler();

            expect(mockCacheManager.reset).toHaveBeenCalled();
        });

        it('should handle cache manager without reset method', async () => {
            const mockCacheManager = {};

            const handler = GracefulShutdownService.createCacheShutdownHandler(mockCacheManager);

            await expect(handler.handler()).resolves.toBeUndefined();
        });
    });

    describe('onApplicationShutdown', () => {
        it('should handle application shutdown with signal', async () => {
            const initiateShutdownSpy = jest.spyOn(service as any, 'initiateShutdown').mockResolvedValue(undefined);

            await service.onApplicationShutdown('SIGTERM');

            expect(initiateShutdownSpy).toHaveBeenCalledWith('SIGTERM');
        });

        it('should not initiate shutdown if already shutting down', async () => {
            service['isShuttingDown'] = true;
            const initiateShutdownSpy = jest.spyOn(service as any, 'initiateShutdown').mockResolvedValue(undefined);

            await service.onApplicationShutdown('SIGTERM');

            expect(initiateShutdownSpy).not.toHaveBeenCalled();
        });

        it('should not initiate shutdown without signal', async () => {
            const initiateShutdownSpy = jest.spyOn(service as any, 'initiateShutdown').mockResolvedValue(undefined);

            await service.onApplicationShutdown();

            expect(initiateShutdownSpy).not.toHaveBeenCalled();
        });
    });
});