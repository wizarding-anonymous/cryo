import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { LibraryService } from '../../library/library.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly libraryService: LibraryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not found on request.');
    }

    // This guard assumes that the resource ID is named 'gameId' in the params.
    // A more robust implementation might use custom decorators to specify the resource.
    const gameId = request.params.gameId;

    if (!gameId) {
      // If there's no gameId in params, maybe it's a general library access.
      // In that case, we can just allow it as long as the user is authenticated.
      return true;
    }

    const ownership = await this.libraryService.checkGameOwnership(
      user.id,
      gameId,
    );

    if (!ownership.owns) {
      throw new ForbiddenException('User does not own this resource.');
    }

    return true;
  }
}
