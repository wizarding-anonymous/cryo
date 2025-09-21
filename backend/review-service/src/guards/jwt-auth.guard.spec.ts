import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for valid Bearer token', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-jwt-token-user_123e4567-e89b-12d3-a456-426614174000',
        },
        user: undefined,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    it('should throw UnauthorizedException for missing authorization header', () => {
      const mockRequest = {
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access token is required');
    });

    it('should throw UnauthorizedException for invalid token format', () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access token is required');
    });

    it('should throw UnauthorizedException for short invalid token', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer short',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Invalid or expired token');
    });

    it('should extract user ID from token with user_ pattern', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer token-with-user_abc123def456-pattern',
        },
        user: undefined,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: 'abc123def456-',
      });
    });

    it('should use fallback user ID for tokens without user_ pattern', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-long-token-without-user-pattern',
        },
        user: undefined,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: 'test-user-id',
      });
    });

    it('should handle authorization header with only Bearer', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access token is required');
    });

    it('should handle malformed authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: 'NotBearer token',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access token is required');
    });

    it('should handle empty authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access token is required');
    });
  });
});