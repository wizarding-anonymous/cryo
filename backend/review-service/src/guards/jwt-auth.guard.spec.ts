import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let mockExecutionContext: Partial<ExecutionContext>;
    let mockRequest: any;

    beforeEach(() => {
        guard = new JwtAuthGuard();
        mockRequest = {
            headers: {},
        };
        mockExecutionContext = {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => ({} as any),
                getNext: () => jest.fn() as any,
            }),
        };
    });

    describe('canActivate', () => {
        it('should throw UnauthorizedException when no token is provided', () => {
            expect(() => {
                guard.canActivate(mockExecutionContext as ExecutionContext);
            }).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when token format is invalid', () => {
            mockRequest.headers.authorization = 'Bearer invalid-token';

            expect(() => {
                guard.canActivate(mockExecutionContext as ExecutionContext);
            }).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when token is expired', () => {
            // Create an expired token (more than 24 hours old)
            const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
            const expiredToken = Buffer.from(`user123:test@example.com:${expiredTimestamp}`).toString('base64');
            mockRequest.headers.authorization = `Bearer ${expiredToken}`;

            expect(() => {
                guard.canActivate(mockExecutionContext as ExecutionContext);
            }).toThrow(UnauthorizedException);
        });

        it('should return true and attach user to request when token is valid', () => {
            // Create a valid token
            const validTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
            const validToken = Buffer.from(`user123:test@example.com:${validTimestamp}`).toString('base64');
            mockRequest.headers.authorization = `Bearer ${validToken}`;

            const result = guard.canActivate(mockExecutionContext as ExecutionContext);

            expect(result).toBe(true);
            expect(mockRequest.user).toEqual({
                id: 'user123',
                email: 'test@example.com',
            });
        });

        it('should handle malformed authorization header', () => {
            mockRequest.headers.authorization = 'InvalidFormat';

            expect(() => {
                guard.canActivate(mockExecutionContext as ExecutionContext);
            }).toThrow(UnauthorizedException);
        });

        it('should handle missing authorization header', () => {
            delete mockRequest.headers.authorization;

            expect(() => {
                guard.canActivate(mockExecutionContext as ExecutionContext);
            }).toThrow(UnauthorizedException);
        });
    });
});