import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRequest } from '../../common/interfaces/auth-request.interface';
import { UserServiceClient } from '../../clients/user.service.client';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly userServiceClient: UserServiceClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException(
          'Missing or invalid authorization header',
        );
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('Invalid token: token is missing.');
      }

      // Delegate token validation to the User Service
      const userPayload = await this.userServiceClient.validateToken(token);
      if (!userPayload || !userPayload.userId) {
        throw new UnauthorizedException('Invalid user payload from token');
      }

      request.user = userPayload;
    } catch (e) {
      // If the error comes from the User Service (e.g., AxiosError),
      // it will be caught here. We should return a standard UnauthorizedException.
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}
