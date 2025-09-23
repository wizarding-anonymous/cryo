import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatusService } from './status.service';
import { OnlineStatus } from './entities/online-status.entity';
import { FriendsService } from '../friends/friends.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import { Cache } from 'cache-manager';
import { UserStatus } from './entities/user-status.enum';

const mockStatusRepository = {
  upsert: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockFriendsService = {
  getFriends: jest.fn(),
};

describe('StatusService', () => {
  let service: StatusService;
  let repository: Repository<OnlineStatus>;
  let cacheManager: Cache;
  let friendsService: FriendsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusService,
        {
          provide: getRepositoryToken(OnlineStatus),
          useValue: mockStatusRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: FriendsService,
          useValue: mockFriendsService,
        },
      ],
    }).compile();

    service = module.get<StatusService>(StatusService);
    repository = module.get<Repository<OnlineStatus>>(getRepositoryToken(OnlineStatus));
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    friendsService = module.get<FriendsService>(FriendsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setOnlineStatus', () => {
    it('should upsert status to DB and set cache', async () => {
      const userId = 'user1';
      const currentGame = 'Game1';
      await service.setOnlineStatus(userId, currentGame);

      expect(mockStatusRepository.upsert).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('setOfflineStatus', () => {
    it('should upsert status to DB and delete from cache', async () => {
      const userId = 'user1';
      await service.setOfflineStatus(userId);

      expect(mockStatusRepository.upsert).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalled();
    });
  });

  describe('getUserStatus', () => {
    const userId = 'user1';
    const status = { userId, status: UserStatus.ONLINE, lastSeen: new Date() };

    it('should return status from cache if available', async () => {
      mockCacheManager.get.mockResolvedValue(status);
      const result = await service.getUserStatus(userId);
      expect(result).toEqual(status);
      expect(mockStatusRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('should return status from DB if not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockStatusRepository.findOneBy.mockResolvedValue(status);
      const result = await service.getUserStatus(userId);
      expect(result).toEqual(status);
      expect(mockCacheManager.set).toHaveBeenCalledWith(`user-status:${userId}`, status, 900);
    });

    it('should return AWAY status if user was last seen more than 15 minutes ago', async () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 mins ago
      const onlineStatus = {
        userId,
        status: UserStatus.ONLINE,
        lastSeen: oldDate,
      };
      mockCacheManager.get.mockResolvedValue(onlineStatus);

      const result = await service.getUserStatus(userId);
      expect(result?.status).toEqual(UserStatus.AWAY);
    });
  });

  describe('getFriendsStatus', () => {
    it("should return friends' statuses", async () => {
      const userId = 'user1';
      const friends = [{ friendId: 'user2' }, { friendId: 'user3' }];
      mockFriendsService.getFriends.mockResolvedValue({ friends });

      // Mock getUserStatus to be callable
      const getUserStatusSpy = jest
        .spyOn(service, 'getUserStatus')
        .mockResolvedValueOnce({
          userId: 'user2',
          status: UserStatus.ONLINE,
          lastSeen: new Date(),
          currentGame: 'Game2',
        } as any)
        .mockResolvedValueOnce(null); // user3 is offline

      const result = await service.getFriendsStatus(userId);

      expect(result).toHaveLength(2);
      expect(result[0]?.status).toEqual(UserStatus.ONLINE);
      expect(result[1]?.status).toEqual(UserStatus.OFFLINE);
      expect(getUserStatusSpy).toHaveBeenCalledTimes(2);
    });
  });
});
