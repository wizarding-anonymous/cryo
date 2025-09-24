import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: jest.Mocked<AuthService>;
  let mockContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    authService = {
      verifyBearerToken: jest.fn(),
    } as any;

    mockRequest = {
      headers: {},
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
    } as any;

    guard = new AuthGuard(authService);
  });

  describe('canActivate', () => {
    it('should return true and set user when valid token provided', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      mockRequest.headers.authorization = 'Bearer valid-token';
      authService.verifyBearerToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBe(mockUser);
      expect(authService.verifyBearerToken).toHaveBeenCalledWith('Bearer valid-token');
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      authService.verifyBearerToken.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      expect(authService.verifyBearerToken).toHaveBeenCalledWith(undefined);
    });

    it('should throw UnauthorizedException when invalid token', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      authService.verifyBearerToken.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      expect(authService.verifyBearerToken).toHaveBeenCalledWith('Bearer invalid-token');
    });

    it('should throw UnauthorizedException when malformed authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidFormat token';
      authService.verifyBearerToken.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      expect(authService.verifyBearerToken).toHaveBeenCalledWith('InvalidFormat token');
    });
  });
});