import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnlineStatus } from './entities/online-status.entity';
import { UserStatus } from './entities/user-status.enum';
import { FriendsService } from '../friends/friends.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FriendStatusDto } from './dto/friend-status.dto';

const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(OnlineStatus)
    private readonly statusRepository: Repository<OnlineStatus>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly friendsService: FriendsService,
  ) {}

  private getCacheKey(userId: string): string {
    return `user-status:${userId}`;
  }

  async setOnlineStatus(userId: string, currentGame?: string): Promise<void> {
    const statusData = {
      userId,
      status: UserStatus.ONLINE,
      lastSeen: new Date(),
      currentGame,
    };

    await this.statusRepository.upsert(statusData, ['userId']);
    await this.cacheManager.set(this.getCacheKey(userId), statusData, CACHE_TTL_SECONDS);
  }

  async setOfflineStatus(userId: string): Promise<void> {
    const statusData = {
      userId,
      status: UserStatus.OFFLINE,
      lastSeen: new Date(),
      currentGame: undefined,
    };

    await this.statusRepository.upsert(statusData, ['userId']);
    await this.cacheManager.del(this.getCacheKey(userId));
  }

  async getUserStatus(userId: string): Promise<OnlineStatus | null> {
    const cachedStatus = await this.cacheManager.get<OnlineStatus>(this.getCacheKey(userId));
    if (cachedStatus) {
      return this.checkAwayStatus(cachedStatus);
    }

    const dbStatus = await this.statusRepository.findOneBy({ userId });
    if (dbStatus) {
      await this.cacheManager.set(this.getCacheKey(userId), dbStatus, CACHE_TTL_SECONDS);
      return this.checkAwayStatus(dbStatus);
    }

    return null;
  }

  async getFriendsStatus(userId: string): Promise<FriendStatusDto[]> {
    const { friends } = await this.friendsService.getFriends(userId, {
      page: 1,
      limit: 1000,
    }); // Assuming max 1000 friends for now
    if (!friends || friends.length === 0) {
      return [];
    }

    const friendIds = friends.map((f) => f.friendId);
    const friendStatuses: FriendStatusDto[] = [];

    for (const friendId of friendIds) {
      const status = await this.getUserStatus(friendId);
      if (status) {
        friendStatuses.push({
          userId: friendId,
          status: status.status,
          currentGame: status.currentGame,
          lastSeen: status.lastSeen,
        });
      } else {
        // If no status record, assume offline
        friendStatuses.push({
          userId: friendId,
          status: UserStatus.OFFLINE,
          lastSeen: new Date(0), // Epoch time for "never seen"
        });
      }
    }

    return friendStatuses;
  }

  async updateLastSeen(userId: string): Promise<void> {
    const now = new Date();
    await this.statusRepository.update({ userId }, { lastSeen: now });

    const key = this.getCacheKey(userId);
    const cachedStatus = await this.cacheManager.get<OnlineStatus>(key);
    if (cachedStatus) {
      cachedStatus.lastSeen = now;
      await this.cacheManager.set(key, cachedStatus, CACHE_TTL_SECONDS);
    }
  }

  private checkAwayStatus(status: OnlineStatus): OnlineStatus {
    if (status.status === UserStatus.ONLINE) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (status.lastSeen < fifteenMinutesAgo) {
        status.status = UserStatus.AWAY;
      }
    }
    return status;
  }
}
