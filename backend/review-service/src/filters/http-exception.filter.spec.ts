import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
    let filter: HttpExceptionFilter;
    let mockArgumentsHost: Partial<ArgumentsHost>;
    let mockResponse: any;
    let mockRequest: any;

    beforeEach(() => {
        filter = new HttpExceptionFilter();

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        mockRequest = {
            url: '/reviews/123',
            method: 'GET',
        };

        mockArgumentsHost = {
            switchToHttp: () => ({
                getResponse: () => mockResponse,
                getRequest: () => mockRequest,
                getNext: () => jest.fn() as any,
            }),
        };
    });

    describe('catch', () => {
        it('should handle HttpException with string response', () => {
            const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'NOT_FOUND_ERROR',
                    message: 'Not found',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle HttpException with object response', () => {
            const exception = new HttpException(
                {
                    message: 'Validation failed',
                    error: 'VALIDATION_ERROR',
                    details: { field: 'rating' },
                },
                HttpStatus.BAD_REQUEST,
            );

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: { field: 'rating' },
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle duplicate review error', () => {
            const exception = new Error('duplicate review detected');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(409);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'DUPLICATE_REVIEW_ERROR',
                    message: 'You have already reviewed this game',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle game ownership error', () => {
            const exception = new Error('game ownership verification failed');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'GAME_OWNERSHIP_ERROR',
                    message: 'You must own the game to leave a review',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle review not found error', () => {
            const exception = new Error('review not found in database');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'REVIEW_NOT_FOUND_ERROR',
                    message: 'Review not found',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle external service error', () => {
            const exception = new Error('external service connection failed');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(503);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'EXTERNAL_SERVICE_ERROR',
                    message: 'External service temporarily unavailable',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle generic Error', () => {
            const exception = new Error('Something went wrong');

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });

        it('should handle unknown exception type', () => {
            const exception = 'string exception';

            filter.catch(exception, mockArgumentsHost as ArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred',
                    details: {},
                    timestamp: expect.any(String),
                    path: '/reviews/123',
                },
            });
        });
    });
});