import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // In a real application, this guard would:
    // 1. Use @nestjs/passport and passport-jwt strategy.
    // 2. Extract the JWT from the Authorization header.
    // 3. Validate the token's signature and expiration.
    // 4. Potentially call a User Service to ensure the user still exists.
    // 5. Attach the user payload to the request object.

    // For this task, we'll simulate a simple check.
    // We will assume the token is valid and a user object is attached.
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found.');
    }

    // Placeholder for decoded user payload
    request.user = {
      id: 'placeholder-user-id',
      roles: ['user'],
    };

    return true;
  }
}
