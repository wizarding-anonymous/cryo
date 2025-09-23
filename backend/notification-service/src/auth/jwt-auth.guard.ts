import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    // In a real implementation, this guard would use @nestjs/passport to validate
    // a JWT token from the Authorization header.

    // For this MVP task, we will simulate a logged-in user by attaching a mock
    // user object to the request. This allows the controller logic to be
    // written as if a real authentication flow is in place.
    request.user = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }; // Mock user

    return true; // For now, we allow all requests to proceed.
  }
}
