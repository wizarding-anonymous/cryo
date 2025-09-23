import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../src/auth/guards/ownership.guard';
import { RoleGuard, ROLES_KEY } from '../src/auth/guards/role.guard';
import { LibraryService } from '../src/library/library.service';

// Mock ExecutionContext for testing
const createMockExecutionContext = (request: any): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => request,
  }),
  getClass: () => {},
  getHandler: () => {},
});

describe('Guards', () => {
  describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
      guard = new JwtAuthGuard();
    });

    it('should return true if authorization header exists', () => {
      const request = { headers: { authorization: 'Bearer token' } };
      const context = createMockExecutionContext(request);
      expect(guard.canActivate(context)).toBe(true);
      expect(request).toHaveProperty('user');
    });

    it('should throw UnauthorizedException if no auth header', () => {
      const request = { headers: {} };
      const context = createMockExecutionContext(request);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('RoleGuard', () => {
    let guard: RoleGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RoleGuard(reflector);
    });

    it('should grant access if no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext({});
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should grant access if user has the required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const request = { user: { roles: ['admin', 'user'] } };
      const context = createMockExecutionContext(request);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access if user does not have the required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const request = { user: { roles: ['user'] } };
      const context = createMockExecutionContext(request);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('OwnershipGuard', () => {
    let guard: OwnershipGuard;
    const mockLibraryService = {
      checkGameOwnership: jest.fn(),
    };

    beforeEach(() => {
      guard = new OwnershipGuard(mockLibraryService as any as LibraryService);
    });

    it('should grant access if user owns the resource', async () => {
      const request = { user: { id: 'user1' }, params: { gameId: 'game1' } };
      const context = createMockExecutionContext(request);
      mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: true });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(mockLibraryService.checkGameOwnership).toHaveBeenCalledWith('user1', 'game1');
    });

    it('should deny access if user does not own the resource', async () => {
      const request = { user: { id: 'user1' }, params: { gameId: 'game1' } };
      const context = createMockExecutionContext(request);
      mockLibraryService.checkGameOwnership.mockResolvedValue({ owns: false });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
