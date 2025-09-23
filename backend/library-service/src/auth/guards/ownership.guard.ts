import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LibraryService } from '../../library/library.service';

// Decorator to skip ownership check for specific endpoints
export const SKIP_OWNERSHIP_KEY = 'skipOwnership';
export const SkipOwnership = () =>
  Reflector.createDecorator<boolean>({ key: SKIP_OWNERSHIP_KEY });

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private readonly libraryService: LibraryService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if ownership check should be skipped for this endpoint
    const skipOwnership = this.reflector.getAllAndOverride<boolean>(
      SKIP_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipOwnership) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      this.logger.warn('OwnershipGuard: User not found on request');
      throw new UnauthorizedException('Authentication required');
    }

    // Check for gameId in params (for specific game ownership)
    const gameId = request.params.gameId;

    if (!gameId) {
      // If there's no gameId in params, this is general library access
      // Allow it as long as the user is authenticated
      this.logger.debug(
        `OwnershipGuard: Allowing general library access for user ${user.id}`,
      );
      return true;
    }

    try {
      // Check if user owns the specific game
      const ownership = await this.libraryService.checkGameOwnership(
        user.id,
        gameId,
      );

      if (!ownership.owns) {
        this.logger.warn(
          `OwnershipGuard: User ${user.id} does not own game ${gameId}`,
        );
        throw new ForbiddenException(`You do not own this game`);
      }

      this.logger.debug(`OwnershipGuard: User ${user.id} owns game ${gameId}`);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `OwnershipGuard: Error checking ownership for user ${user.id}, game ${gameId}: ${errorMessage}`,
      );
      throw new ForbiddenException('Unable to verify game ownership');
    }
  }
}
