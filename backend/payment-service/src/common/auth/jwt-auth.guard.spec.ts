import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it("should extend AuthGuard('jwt')", () => {
    expect(Object.getPrototypeOf(JwtAuthGuard)).toBe(AuthGuard('jwt'));
  });

  describe('handleRequest', () => {
    it('should return user when authentication is successful', () => {
      const user = { userId: 'user123', username: 'testuser' };

      const result = guard.handleRequest(null, user, null);

      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(
        new UnauthorizedException('Unauthorized access'),
      );
    });

    it('should throw UnauthorizedException when user is undefined', () => {
      expect(() => guard.handleRequest(null, undefined, null)).toThrow(
        new UnauthorizedException('Unauthorized access'),
      );
    });

    it('should throw specific error for expired token', () => {
      const info = { name: 'TokenExpiredError' };

      expect(() => guard.handleRequest(null, null, info)).toThrow(
        new UnauthorizedException('Token has expired'),
      );
    });

    it('should throw specific error for invalid token', () => {
      const info = { name: 'JsonWebTokenError' };

      expect(() => guard.handleRequest(null, null, info)).toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });

    it('should throw specific error for not active token', () => {
      const info = { name: 'NotBeforeError' };

      expect(() => guard.handleRequest(null, null, info)).toThrow(
        new UnauthorizedException('Token not active'),
      );
    });

    it('should throw the original error when err is provided', () => {
      const originalError = new Error('Custom error');

      expect(() => guard.handleRequest(originalError, null, null)).toThrow(
        originalError,
      );
    });

    it('should prioritize original error over info', () => {
      const originalError = new Error('Custom error');
      const info = { name: 'TokenExpiredError' };

      expect(() => guard.handleRequest(originalError, null, info)).toThrow(
        originalError,
      );
    });
  });
});
