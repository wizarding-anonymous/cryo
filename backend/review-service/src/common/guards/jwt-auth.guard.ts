import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * A mock JWT Auth Guard for development purposes.
 * In a real-world scenario, this guard would be responsible for:
 * 1. Extracting the JWT token from the Authorization header.
 * 2. Validating the token's signature and expiration.
 * 3. Fetching the user from the database based on the token's payload.
 * 4. Attaching the user object to the request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // For the purpose of this MVP implementation, we are using a mock user.
    // This simulates a successfully authenticated user.
    request.user = {
      id: '123e4567-e89b-12d3-a456-426614174000', // A mock user UUID
      roles: ['user'],
    };

    return true;
  }
}
