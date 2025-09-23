import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { FriendsService } from '../../friends/friends.service';
import { NotFriendsException } from '../../common/exceptions/not-friends.exception';
import { AuthRequest } from '../../common/interfaces/auth-request.interface';

@Injectable()
export class FriendshipGuard implements CanActivate {
  constructor(
    // Using forwardRef is not ideal, but for this code generation process it's acceptable
    // In a real app, module organization would prevent circular dependencies.
    @Inject(FriendsService) private readonly friendsService: FriendsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const fromUserId = request.user?.userId;

    if (!fromUserId) {
      // This should be caught by JwtAuthGuard, but as a safeguard:
      return false;
    }

    // The friend's ID is in the body for sending a message.
    const toUserId = request.body?.toUserId;

    if (!toUserId) {
      // If no user to check against, let it pass.
      // The controller's DTO validation will catch the missing field if it's required.
      return true;
    }

    const areFriends = await this.friendsService.checkFriendship(fromUserId, toUserId);

    if (!areFriends) {
      throw new NotFriendsException();
    }

    return true;
  }
}
