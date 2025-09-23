import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type RequestUser = {
  id: string;
  username: string;
  roles?: string[];
  [key: string]: unknown;
};

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Common role constants
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator',
  INTERNAL_SERVICE: 'internal-service',
} as const;

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      this.logger.warn('RoleGuard: No user found on request');
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.id) {
      this.logger.warn('RoleGuard: User ID not found');
      throw new UnauthorizedException('Invalid user data');
    }

    if (!Array.isArray(user.roles)) {
      this.logger.warn(
        `RoleGuard: User ${user.id} has no roles or invalid roles format`,
      );
      throw new ForbiddenException('User roles not found');
    }

    // Check if user has any of the required roles
    const hasRole = user.roles.some((role: string) =>
      requiredRoles.includes(role),
    );

    if (!hasRole) {
      this.logger.warn(
        `RoleGuard: User ${user.id} with roles [${user.roles.join(', ')}] lacks required roles [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    this.logger.debug(
      `RoleGuard: User ${user.id} authorized with roles [${user.roles.join(', ')}]`,
    );
    return true;
  }
}
