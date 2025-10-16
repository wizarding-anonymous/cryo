import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OptimizedUserRepository } from './optimized-user.repository';
import { User } from '../entities/user.entity';
import { TypeOrmQueryCacheService } from '../../common/cache/typeorm-query-cache.service';
import { SlowQueryMonitorService } from '../../database/slow-query-monitor.service';

describe('OptimizedUserRepository', () => {
  let optimizedRepository: OptimizedUserRepository;
  let userRepository: Repository<User>;
  let cacheService: TypeOrmQueryCacheService;
  let slowQueryMonitor: SlowQueryMonitorService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashed_password',
    name: 'Test User',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    avatarUrl: null,
    preferences: null,
    privacySettings: null,
    isActive: true,
    metadata: null,
  };

  const mockQueryBuilder = {
    createQueryBuilder: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    manager: {
      query: jest.fn(),
    },
    createQueryRunner: jest.fn(),
    getMetadata: jest.fn().mockReturnValue({
      name: 'User',
      tableName: 'users',
    }),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidateByTags: jest.fn(),
    getStats: jest.fn(),
  };

  const mockSlowQueryMonitor = {
    shouldMonitorQuery: jest.fn().mockReturnValue(true),
    getSlowQueryThreshold: jest.fn().mockReturnValue(1000),
    logSlowQuery: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedUserRepository,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: TypeOrmQueryCacheService,
          useValue: mockCacheService,
        },
        {
          provide: SlowQueryMonitorService,
          useValue: mockSlowQueryMonitor,
        },
      ],
    }).compile();

    optimizedRepository = module.get<OptimizedUserRepository>(
      OptimizedUserRepository,
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    cacheService = module.get<TypeOrmQueryCacheService>(
      TypeOrmQueryCacheService,
    );
    slowQueryMonitor = module.get<SlowQueryMonitorService>(
      SlowQueryMonitorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('findWithCursorPagination', () => {
    it('should return paginated users without cursor', async () => {
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithCursorPagination({
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
      expect(result.hasMore).toBe(false);
    });

    it('should return paginated users with cursor', async () => {
      const mockUsers = [mockUser];
      const cursor = new Date().toISOString();

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithCursorPagination({
        cursor,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });

    it('should handle hasMore correctly when there are more records', async () => {
      const mockUsers = Array(11).fill(mockUser); // 11 users (limit + 1)

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithCursorPagination({
        limit: 10,
      });

      expect(result.data).toHaveLength(10); // Should remove the extra record
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should limit maximum page size to 1000', async () => {
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithCursorPagination({
        limit: 5000, // Exceeds maximum
      });

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('findWithFiltersAndPagination', () => {
    it('should apply isActive filter', async () => {
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithFiltersAndPagination(
        { isActive: true },
        { limit: 10 },
      );

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });

    it('should apply hasLastLogin filter', async () => {
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithFiltersAndPagination(
        { hasLastLogin: true },
        { limit: 10 },
      );

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });

    it('should apply date range filters', async () => {
      const mockUsers = [mockUser];
      const createdAfter = new Date('2024-01-01');
      const createdBefore = new Date('2024-12-31');

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithFiltersAndPagination(
        { createdAfter, createdBefore },
        { limit: 10 },
      );

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });

    it('should apply email domain filter', async () => {
      const mockUsers = [mockUser];
      const emailDomain = 'example.com';

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findWithFiltersAndPagination(
        { emailDomain },
        { limit: 10 },
      );

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('findByIdsBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await optimizedRepository.findByIdsBatch([]);
      expect(result).toEqual([]);
    });

    it('should use cached query for small arrays', async () => {
      const ids = ['id1', 'id2', 'id3'];
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findByIdsBatch(ids);

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        [ids],
        expect.objectContaining({
          ttl: 300,
          tags: ['users', 'batch'],
        }),
      );
      expect(result).toEqual(mockUsers);
    });

    it('should chunk large arrays', async () => {
      const ids = Array(1500)
        .fill(0)
        .map((_, i) => `id${i}`);
      const mockUsers = [mockUser];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findByIdsBatch(ids, {
        chunkSize: 1000,
      });

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalledTimes(2); // 1500 ids / 1000 chunk size
      expect(result).toEqual([...mockUsers, ...mockUsers]); // Results from both chunks
    });
  });

  describe('createBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await optimizedRepository.createBatch([]);
      expect(result).toEqual([]);
    });

    it('should validate data when requested', async () => {
      const invalidUserData = [{ email: 'test@example.com' }]; // Missing name and password

      await expect(
        optimizedRepository.createBatch(invalidUserData, {
          validateBeforeInsert: true,
        }),
      ).rejects.toThrow('Validation errors');
    });

    it('should create users in chunks', async () => {
      const userData = Array(1000)
        .fill(0)
        .map((_, i) => ({
          email: `user${i}@example.com`,
          name: `User ${i}`,
          password: 'hashed_password',
        }));

      const mockInsertResult = {
        generatedMaps: [mockUser],
      };
      mockQueryBuilder.execute.mockResolvedValue(mockInsertResult);

      const result = await optimizedRepository.createBatch(userData, {
        chunkSize: 500,
      });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledTimes(2); // 1000 / 500 chunks
      expect(result).toHaveLength(2); // One user from each chunk
    });

    it('should skip errors when configured', async () => {
      const userData = [
        { email: 'user1@example.com', name: 'User 1', password: 'password' },
        { email: 'user2@example.com', name: 'User 2', password: 'password' },
      ];

      mockQueryBuilder.execute
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ generatedMaps: [mockUser] });

      const result = await optimizedRepository.createBatch(userData, {
        chunkSize: 1,
        skipErrors: true,
      });

      expect(result).toHaveLength(1); // Only successful chunk
    });
  });

  describe('updateBatch', () => {
    it('should return early for empty input', async () => {
      await optimizedRepository.updateBatch([]);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should update users in chunks', async () => {
      const updates = [
        { id: 'id1', data: { name: 'Updated Name 1' } },
        { id: 'id2', data: { name: 'Updated Name 2' } },
      ];

      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await optimizedRepository.updateBatch(updates);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('softDeleteBatch', () => {
    it('should return early for empty input', async () => {
      await optimizedRepository.softDeleteBatch([]);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should soft delete users in chunks', async () => {
      const ids = ['id1', 'id2', 'id3'];
      mockQueryBuilder.execute.mockResolvedValue({ affected: 3 });

      await optimizedRepository.softDeleteBatch(ids);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(User);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        deletedAt: expect.any(Date),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id IN (:...ids)', {
        ids,
      });
    });
  });

  describe('getActiveUsersCount', () => {
    it('should return count of active users', async () => {
      const expectedCount = 100;
      mockQueryBuilder.getCount.mockResolvedValue(expectedCount);

      const result = await optimizedRepository.getActiveUsersCount();

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.deletedAt IS NULL',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.isActive = :isActive',
        { isActive: true },
      );
      expect(result).toBe(expectedCount);
    });

    it('should apply additional filters', async () => {
      const expectedCount = 50;
      mockQueryBuilder.getCount.mockResolvedValue(expectedCount);

      const result = await optimizedRepository.getActiveUsersCount({
        hasLastLogin: true,
        createdAfter: new Date('2024-01-01'),
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.lastLoginAt IS NOT NULL',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.createdAt >= :createdAfter',
        { createdAfter: new Date('2024-01-01') },
      );
      expect(result).toBe(expectedCount);
    });
  });

  describe('getUserStatistics', () => {
    it('should return comprehensive user statistics', async () => {
      const mockStatsResult = [
        {
          total_users: '1000',
          active_users: '800',
          inactive_users: '200',
          users_with_recent_login: '150',
          users_created_today: '50',
          users_created_this_week: '300',
          users_created_this_month: '500',
        },
      ];

      // Mock the executeCachedQuery method
      jest
        .spyOn(optimizedRepository, 'executeCachedQuery')
        .mockResolvedValue(mockStatsResult);

      const result = await optimizedRepository.getUserStatistics();

      expect(optimizedRepository.executeCachedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array),
        expect.objectContaining({
          ttl: 60,
          tags: ['statistics', 'users', 'time-sensitive'],
        }),
      );

      expect(result).toEqual({
        totalUsers: 1000,
        activeUsers: 800,
        inactiveUsers: 200,
        usersWithRecentLogin: 150,
        usersCreatedToday: 50,
        usersCreatedThisWeek: 300,
        usersCreatedThisMonth: 500,
      });
    });
  });

  describe('findRecentlyActiveUsers', () => {
    it('should find users active within specified days', async () => {
      const mockUsers = [mockUser];
      mockQueryBuilder.getMany.mockResolvedValue(mockUsers);

      const result = await optimizedRepository.findRecentlyActiveUsers(7, {
        limit: 10,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.deletedAt IS NULL',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.isActive = :isActive',
        { isActive: true },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.lastLoginAt >= :cutoffDate',
        { cutoffDate: expect.any(Date) },
      );
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('findByEmailDomain', () => {
    it('should delegate to findWithFiltersAndPagination', async () => {
      const domain = 'example.com';
      const paginationOptions = { limit: 10 };
      const mockResult = { data: [mockUser], hasMore: false };

      // Mock the method by spying on it
      const spy = jest
        .spyOn(optimizedRepository, 'findWithFiltersAndPagination')
        .mockResolvedValue(mockResult);

      const result = await optimizedRepository.findByEmailDomain(
        domain,
        paginationOptions,
      );

      expect(spy).toHaveBeenCalledWith(
        { emailDomain: domain },
        paginationOptions,
      );
      expect(result).toEqual(mockResult);

      spy.mockRestore();
    });
  });
});
