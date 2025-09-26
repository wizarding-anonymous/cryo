import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './auth.decorator';
import { AuthenticatedRequest } from '../common/interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    this.logger.log(
      `Checking roles for user ${user.id}. Required: ${requiredRoles.join(', ')}`,
    );

    const hasRole = requiredRoles.some((role) => {
      if (role === 'admin') {
        return user.isAdmin === true;
      }
      return user.roles?.includes(role);
    });

    if (!hasRole) {
      this.logger.warn(
        `User ${user.id} lacks required roles: ${requiredRoles.join(', ')}`,
      );
    } else {
      this.logger.log(`User ${user.id} has required roles`);
    }

    return hasRole;
  }
}
