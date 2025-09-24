import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthService } from '../auth/auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
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

    guard = new AdminGuard(authService);
  });

  describe('canActivate', () => {
    it('should return true when user has isAdmin=true', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com', isAdmin: true };
      mockRequest.user = mockUser;

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBe(mockUser);
      expect(authService.verifyBearerToken).not.toHaveBeenCalled();
    });

    it('should return true when user has admin role in roles array', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com', roles: ['admin', 'user'] };
      mockRequest.user = mockUser;

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBe(mockUser);
    });

    it('should return true when user has role=admin', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com', role: 'admin' };
      mockRequest.user = mockUser;

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBe(mockUser);
    });

    it('should verify token when no user in request and user is admin', async () => {
      const mockUser = { id: 'admin123', email: 'admin@example.com', isAdmin: true };
      mockRequest.headers.authorization = 'Bearer admin-token';
      authService.verifyBearerToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBe(mockUser);
      expect(authService.verifyBearerToken).toHaveBeenCalledWith('Bearer admin-token');
    });

    it('should throw ForbiddenException when user is not admin', async () => {
      const mockUser = { id: 'user123', email: 'user@example.com', isAdmin: false, roles: ['user'] };
      mockRequest.user = mockUser;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when no user and token verification fails', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      authService.verifyBearerToken.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when user has no admin privileges', async () => {
      const mockUser = { id: 'user123', email: 'user@example.com' };
      mockRequest.user = mockUser;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('should handle user with empty roles array', async () => {
      const mockUser = { id: 'user123', email: 'user@example.com', roles: [] };
      mockRequest.user = mockUser;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });
});