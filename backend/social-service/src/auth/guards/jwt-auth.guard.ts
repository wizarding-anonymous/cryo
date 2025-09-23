import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRequest } from '../../common/interfaces/auth-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid authorization header');
      }

      const token = authHeader.split(' ')[1];

      // In a real application, we would use a library like 'jsonwebtoken'
      // to verify the token against a secret or public key from an auth service.
      // For this implementation, we will simulate a decoded payload from any non-empty token.

      if (!token) {
        throw new UnauthorizedException('Invalid token: token is missing.');
      }

      // Simulate a decoded user payload.
      // In a real app, this would come from the decoded token.
      const user = { userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' };

      request.user = user;
    } catch (e) {
      // Re-throw any internally thrown UnauthorizedException, or wrap other errors.
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}
