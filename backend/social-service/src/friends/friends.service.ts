import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Friendship } from './entities/friendship.entity';
import { FriendshipStatus } from './entities/friendship-status.enum';
import { FriendsQueryDto } from './dto/friends-query.dto';
import { AlreadyFriendsException } from '../common/exceptions/already-friends.exception';
import { FriendRequestNotFoundException } from '../common/exceptions/friend-request-not-found.exception';
import { NotFriendsException } from '../common/exceptions/not-friends.exception';
import { UserServiceClient } from '../clients/user.service.client';
import { NotificationServiceClient } from '../clients/notification.service.client';
import { AchievementServiceClient } from '../clients/achievement.service.client';
import { UserSearchResultDto } from './dto/user-search-result.dto';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship)
    private readonly friendshipRepository: Repository<Friendship>,
    private readonly userServiceClient: UserServiceClient,
    private readonly notificationServiceClient: NotificationServiceClient,
    private readonly achievementServiceClient: AchievementServiceClient,
  ) {}

  async sendFriendRequest(
    fromUserId: string,
    toUserId: string,
  ): Promise<Friendship> {
    if (fromUserId === toUserId) {
      throw new Error('Cannot send a friend request to yourself.');
    }

    const existingFriendship = await this.findFriendship(fromUserId, toUserId);

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        throw new AlreadyFriendsException();
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        throw new Error('A friend request is already pending.');
      }
    }

    const newRequest = this.friendshipRepository.create({
      userId: fromUserId,
      friendId: toUserId,
      status: FriendshipStatus.PENDING,
      requestedBy: fromUserId,
    });

    const savedRequest = await this.friendshipRepository.save(newRequest);

    // Call notification service
    await this.notificationServiceClient.sendNotification({
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `You have a new friend request from user ${fromUserId}`,
      metadata: { fromUserId, requestId: savedRequest.id },
    });

    return savedRequest;
  }

  async acceptFriendRequest(
    requestId: string,
    userId: string,
  ): Promise<Friendship> {
    const request = await this.friendshipRepository.findOneBy({
      id: requestId,
      status: FriendshipStatus.PENDING,
    });

    if (!request || request.friendId !== userId) {
      throw new FriendRequestNotFoundException(requestId);
    }

    request.status = FriendshipStatus.ACCEPTED;

    const reverseFriendship = this.friendshipRepository.create({
      userId: request.friendId,
      friendId: request.userId,
      status: FriendshipStatus.ACCEPTED,
      requestedBy: request.requestedBy,
    });

    await this.friendshipRepository.save([request, reverseFriendship]);

    const friendCount = await this.getFriendsCount(userId);
    if (friendCount === 1) {
      await this.achievementServiceClient.updateProgress({
        userId,
        eventType: 'friend_added',
        eventData: { friendId: request.userId },
      });
    }

    return request;
  }

  async declineFriendRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.friendshipRepository.findOneBy({
      id: requestId,
      status: FriendshipStatus.PENDING,
    });

    if (
      !request ||
      (request.friendId !== userId && request.userId !== userId)
    ) {
      throw new FriendRequestNotFoundException(requestId);
    }

    await this.friendshipRepository.remove(request);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const friendship = await this.findFriendship(userId, friendId);

    if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
      throw new NotFriendsException();
    }

    const reverseFriendship = await this.findFriendship(friendId, userId);

    if (reverseFriendship) {
      await this.friendshipRepository.remove([friendship, reverseFriendship]);
    } else {
      await this.friendshipRepository.remove(friendship);
    }
  }

  async getFriends(userId: string, options: FriendsQueryDto) {
    const { page = 1, limit = 20 } = options;

    const where: FindOptionsWhere<Friendship> = {
      userId: userId,
      status: FriendshipStatus.ACCEPTED,
    };

    const [friends, total] = await this.friendshipRepository.findAndCount({
      where,
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });

    const friendIds = friends.map((f) => f.friendId);
    const friendsInfo = await this.userServiceClient.getUsersByIds(friendIds);

    const friendsWithInfo = friends.map((f) => {
      const info = friendsInfo.find((fi) => fi.id === f.friendId);
      return { ...f, friendInfo: info };
    });

    return {
      friends: friendsWithInfo,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFriendRequests(userId: string): Promise<Friendship[]> {
    return this.friendshipRepository.find({
      where: {
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async checkFriendship(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.findFriendship(userId1, userId2);
    return !!friendship && friendship.status === FriendshipStatus.ACCEPTED;
  }

  private async findFriendship(
    userId1: string,
    userId2: string,
  ): Promise<Friendship | null> {
    return this.friendshipRepository.findOne({
      where: [
        { userId: userId1, friendId: userId2 },
        { userId: userId2, friendId: userId1 },
      ],
    });
  }

  private async getFriendsCount(userId: string): Promise<number> {
    return this.friendshipRepository.count({
      where: { userId, status: FriendshipStatus.ACCEPTED },
    });
  }

  async searchUsers(
    query: string,
    currentUserId: string,
  ): Promise<UserSearchResultDto[]> {
    return this.userServiceClient.searchUsers(query, currentUserId);
  }
}
