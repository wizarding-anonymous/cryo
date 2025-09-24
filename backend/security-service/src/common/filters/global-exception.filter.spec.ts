import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { GlobalExceptionFilter } from './global-exception.filter';
import { SecurityError, BlockedIPError, RateLimitExceededError } from '../exceptions/security.exception';
import { HttpStatus } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
    let filter: GlobalExceptionFilter;
    let mockHttpAdapter: any;
    let mockLogger: any;
    let mockResponse: any;
    let mockRequest: any;

    beforeEach(async () => {
        mockHttpAdapter = {
            reply: jest.fn(),
            getRequestUrl: jest.fn().mockReturnValue('/test-path'),
        };

        mockLogger = {
            warn: jest.fn(),
        };

        mockResponse = {};
        mockRequest = {};

        const mockHttpAdapterHost = {
            httpAdapter: mockHttpAdapter,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GlobalExceptionFilter,
                {
                    provide: HttpAdapterHost,
                    useValue: mockHttpAdapterHost,
                },
                {
                    provide: WINSTON_MODULE_NEST_PROVIDER,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
    });

    const createMockHost = () => ({
        switchToHttp: () => ({
            getResponse: () => mockResponse,
            getRequest: () => mockRequest,
        }),
    });

    it('should handle SecurityError with risk score', () => {
        const exception = new SecurityError('Security check failed', 85);
        const host = createMockHost();

        filter.catch(exception, host as any);

        expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
            mockResponse,
            expect.objectContaining({
                error: expect.objectContaining({
                    code: 'SECURITY_CHECK_FAILED',
                    message: 'Security check failed',
                    riskScore: 85,
                }),
                timestamp: expect.any(String),
                path: '/test-path',
            }),
            HttpStatus.FORBIDDEN,
        );
    });

    it('should handle BlockedIPError with IP and blocked until date', () => {
        const blockedUntil = new Date('2024-01-01T12:00:00Z');
        const exception = new BlockedIPError('192.168.1.1', blockedUntil);
        const host = createMockHost();

        filter.catch(exception, host as any);

        expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
            mockResponse,
            expect.objectContaining({
                error: expect.objectContaining({
                    code: 'IP_BLOCKED',
                    message: 'IP address is blocked',
                    ip: '192.168.1.1',
                    blockedUntil,
                }),
                timestamp: expect.any(String),
                path: '/test-path',
            }),
            HttpStatus.FORBIDDEN,
        );
    });

    it('should handle RateLimitExceededError with limit and reset time', () => {
        const resetTime = new Date('2024-01-01T12:00:00Z');
        const exception = new RateLimitExceededError(100, resetTime);
        const host = createMockHost();

        filter.catch(exception, host as any);

        expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
            mockResponse,
            expect.objectContaining({
                error: expect.objectContaining({
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Rate limit exceeded',
                    limit: 100,
                    resetTime,
                }),
                timestamp: expect.any(String),
                path: '/test-path',
            }),
            HttpStatus.TOO_MANY_REQUESTS,
        );
    });

    it('should log exceptions', () => {
        const exception = new SecurityError('Test error');
        const host = createMockHost();

        filter.catch(exception, host as any);

        expect(mockLogger.warn).toHaveBeenCalledWith(
            'HTTP exception',
            expect.objectContaining({
                status: HttpStatus.FORBIDDEN,
                message: 'Test error',
                path: '/test-path',
            }),
        );
    });
});