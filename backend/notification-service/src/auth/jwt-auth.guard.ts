import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './auth.decorator';
import { AuthenticatedRequest, AuthenticatedUser } from '../common/interfaces';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if the endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log('Public endpoint accessed, skipping authentication');
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    // Log authentication attempt
    this.logger.log(
      `Authentication attempt for ${request.method} ${request.url}`,
    );

    // Check for Authorization header
    if (!authHeader) {
      this.logger.warn('No Authorization header found');
      throw new UnauthorizedException('Authorization header is required');
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn('Invalid Authorization header format');
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Basic token validation (for MVP - in production this would validate JWT signature)
    if (!token || token.length < 10) {
      this.logger.warn('Invalid or missing JWT token');
      throw new UnauthorizedException('Invalid JWT token');
    }

    try {
      // For MVP: Mock JWT validation - in production this would use jsonwebtoken library
      // to verify the token signature and extract user information
      const user = this.validateToken(token);

      if (!user) {
        this.logger.warn('Token validation failed');
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user to request for use in controllers
      request.user = user;

      this.logger.log(`User ${user.id} authenticated successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        'Authentication failed',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Mock JWT token validation for MVP
   * In production, this would use a proper JWT library to validate the token
   */
  private validateToken(token: string): AuthenticatedUser | null {
    // Mock validation logic for MVP
    // In production, this would:
    // 1. Verify JWT signature using secret key
    // 2. Check token expiration
    // 3. Extract user information from payload

    // For MVP, we'll accept specific test tokens and return mock user data
    const mockUsers = {
      'test-user-1': {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'user1@example.com',
        isAdmin: false,
      },
      'test-user-2': {
        id: 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
        email: 'user2@example.com',
        isAdmin: false,
      },
      'test-admin': {
        id: 'c2ggde99-9c0b-4ef8-bb6d-6bb9bd380a33',
        email: 'admin@example.com',
        isAdmin: true,
      },
    };

    // Return user based on token (simplified for MVP)
    return (
      mockUsers[token as keyof typeof mockUsers] || mockUsers['test-user-1']
    );
  }
}
