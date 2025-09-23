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
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException when no token is provided', () => {
    expect(() => {
      guard.canActivate(mockExecutionContext as ExecutionContext);
    }).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is invalid', () => {
    mockRequest.headers.authorization = 'Bearer invalid';

    expect(() => {
      guard.canActivate(mockExecutionContext as ExecutionContext);
    }).toThrow(UnauthorizedException);
  });

  it('should return true and set user when valid token is provided', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    mockRequest.headers.authorization = `Bearer ${validToken}`;

    const result = guard.canActivate(mockExecutionContext as ExecutionContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user.id).toBeDefined();
  });

  it('should handle malformed authorization header', () => {
    mockRequest.headers.authorization = 'InvalidFormat';

    expect(() => {
      guard.canActivate(mockExecutionContext as ExecutionContext);
    }).toThrow(UnauthorizedException);
  });

  it('should extract user ID from token payload', () => {
    // Create a mock JWT token with user ID in payload
    const payload = { sub: 'user-456' };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const mockToken = `header.${encodedPayload}.signature`;
    
    mockRequest.headers.authorization = `Bearer ${mockToken}`;

    const result = guard.canActivate(mockExecutionContext as ExecutionContext);

    expect(result).toBe(true);
    expect(mockRequest.user.id).toBe('user-456');
  });
});