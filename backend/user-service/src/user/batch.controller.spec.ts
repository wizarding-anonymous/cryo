import { Test, TestingModule } from '@nestjs/testing';
import { BatchController } from './batch.controller';
import { UserService } from './user.service';
import { BatchService } from './batch.service';
import { CacheService } from '../common/cache/cache.service';
import { InternalServiceGuard } from '../common/guards';
import { ConfigService } from '@nestjs/config';

import { CreateUserDto } from './dto/create-user.dto';
import { BatchOperationResult } from './batch.service';
import { User } from './entities/user.entity';

describe('BatchController', () => {
  let controller: BatchController;

  const mockUserService = {
    createUsersBatch: jest.fn(),
    findUsersBatch: jest.fn(),
    updateLastLoginBatch: jest.fn(),
    updateUsersBatch: jest.fn(),
    softDeleteUsersBatch: jest.fn(),
    getCacheStats: jest.fn(),
    warmUpCache: jest.fn(),
    clearCache: jest.fn(),
  };

  const mockBatchService = {
    createUsers: jest.fn(),
    getUsersByIds: jest.fn(),
    updateUsers: jest.fn(),
    softDeleteUsers: jest.fn(),
    processInChunks: jest.fn(),
  };

  const mockCacheService = {
    getCacheStats: jest.fn().mockResolvedValue({
      totalKeys: 0,
      hitRate: 0,
      memoryUsage: 0,
    }),
    warmUpCache: jest.fn(),
    clearCache: jest.fn(),
    getUsersBatch: jest.fn(),
    setUsersBatch: jest.fn(),
    redisService: {
      getClient: jest.fn().mockReturnValue({
        flushdb: jest.fn().mockResolvedValue('OK'),
      }),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        INTERNAL_API_KEYS: 'test-api-key',
        INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
        INTERNAL_SERVICE_SECRET: 'test-secret',
        NODE_ENV: 'test',
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        {
          provide: BatchService,
          useValue: mockBatchService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        InternalServiceGuard,
      ],
    })
      .overrideGuard(InternalServiceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BatchController>(BatchController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUsersBatch', () => {
    it('should create users successfully', async () => {
      const createUsersDto = {
        users: [
          {
            email: 'test1@example.com',
            password: 'hashedpassword1',
            name: 'Test User 1',
          },
          {
            email: 'test2@example.com',
            password: 'hashedpassword2',
            name: 'Test User 2',
          },
        ] as CreateUserDto[],
        options: {
          chunkSize: 100,
        },
      };

      const mockResult: BatchOperationResult<User> = {
        successful: [
          {
            id: 'uuid1',
            email: 'test1@example.com',
            name: 'Test User 1',
          } as User,
          {
            id: 'uuid2',
            email: 'test2@example.com',
            name: 'Test User 2',
          } as User,
        ],
        failed: [],
        stats: {
          total: 2,
          successful: 2,
          failed: 0,
        },
      };

      mockBatchService.createUsers.mockResolvedValue(mockResult);

      const result = await controller.createUsersBatch(createUsersDto);

      expect(mockBatchService.createUsers).toHaveBeenCalledWith(
        createUsersDto.users,
        createUsersDto.options,
      );
      expect(result).toEqual({
        success: true,
        message: 'Successfully created 2 out of 2 users',
        data: mockResult.successful,
        failed: mockResult.failed,
        stats: mockResult.stats,
      });
    });

    it('should handle partial failures', async () => {
      const createUsersDto = {
        users: [
          {
            email: 'test1@example.com',
            password: 'hashedpassword1',
            name: 'Test User 1',
          },
          {
            email: 'invalid-email',
            password: 'hashedpassword2',
            name: 'Test User 2',
          },
        ] as CreateUserDto[],
      };

      const mockResult: BatchOperationResult<User> = {
        successful: [
          {
            id: 'uuid1',
            email: 'test1@example.com',
            name: 'Test User 1',
          } as User,
        ],
        failed: [
          {
            item: createUsersDto.users[1],
            error: 'Invalid email format',
          },
        ],
        stats: {
          total: 2,
          successful: 1,
          failed: 1,
        },
      };

      mockBatchService.createUsers.mockResolvedValue(mockResult);

      const result = await controller.createUsersBatch(createUsersDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Successfully created 1 out of 2 users');
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('getUsersBatch', () => {
    it('should lookup users successfully', async () => {
      const userIds = 'uuid1,uuid2,uuid3';
      const mockUsersMap = new Map([
        [
          'uuid1',
          {
            id: 'uuid1',
            email: 'test1@example.com',
            name: 'User 1',
            password: 'hash1',
          } as User,
        ],
        [
          'uuid2',
          {
            id: 'uuid2',
            email: 'test2@example.com',
            name: 'User 2',
            password: 'hash2',
          } as User,
        ],
      ]);

      mockBatchService.getUsersByIds.mockResolvedValue(mockUsersMap);

      const result = await controller.getUsersBatch(userIds);

      expect(mockBatchService.getUsersByIds).toHaveBeenCalledWith(
        ['uuid1', 'uuid2', 'uuid3'],
        {},
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.stats).toEqual({
        requested: 3,
        found: 2,
        missing: 1,
      });
    });

    it('should handle empty ids parameter', async () => {
      const result = await controller.getUsersBatch('');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No user IDs provided');
      expect(result.data).toEqual([]);
      expect(mockBatchService.getUsersByIds).not.toHaveBeenCalled();
    });

    it('should handle chunkSize parameter', async () => {
      const userIds = 'uuid1,uuid2';
      const chunkSize = '50';
      const mockUsersMap = new Map([
        [
          'uuid1',
          {
            id: 'uuid1',
            email: 'test1@example.com',
            name: 'User 1',
            password: 'hash1',
          } as User,
        ],
      ]);

      mockBatchService.getUsersByIds.mockResolvedValue(mockUsersMap);

      await controller.getUsersBatch(userIds, chunkSize);

      expect(mockBatchService.getUsersByIds).toHaveBeenCalledWith(
        ['uuid1', 'uuid2'],
        { chunkSize: 50 },
      );
    });
  });

  describe('updateLastLoginBatch', () => {
    it('should update last login successfully', async () => {
      const updateDto = {
        userIds: ['uuid1', 'uuid2'],
        options: {
          chunkSize: 100,
        },
      };

      const mockResult: BatchOperationResult<User> = {
        successful: [
          { id: 'uuid1', lastLoginAt: new Date() } as User,
          { id: 'uuid2', lastLoginAt: new Date() } as User,
        ],
        failed: [],
        stats: {
          total: 2,
          successful: 2,
          failed: 0,
        },
      };

      mockBatchService.updateUsers.mockResolvedValue(mockResult);

      const result = await controller.updateLastLoginBatch(updateDto);

      expect(mockBatchService.updateUsers).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Updated last login for 2 out of 2 users');
    });

    it('should handle empty userIds', async () => {
      const updateDto = {
        userIds: [],
      };

      const result = await controller.updateLastLoginBatch(updateDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No user IDs provided');
      expect(mockBatchService.updateUsers).not.toHaveBeenCalled();
    });
  });

  describe('updateUsersBatch', () => {
    it('should update users successfully', async () => {
      const updateDto = {
        updates: [
          {
            id: 'uuid1',
            data: {
              name: 'Updated Name 1',
            },
          },
          {
            id: 'uuid2',
            data: {
              email: 'updated2@example.com',
            },
          },
        ],
        options: {
          chunkSize: 50,
        },
      };

      const mockResult: BatchOperationResult<User> = {
        successful: [
          { id: 'uuid1', name: 'Updated Name 1' } as User,
          { id: 'uuid2', email: 'updated2@example.com' } as User,
        ],
        failed: [],
        stats: {
          total: 2,
          successful: 2,
          failed: 0,
        },
      };

      mockBatchService.updateUsers.mockResolvedValue(mockResult);

      const result = await controller.updateUsersBatch(updateDto);

      expect(mockBatchService.updateUsers).toHaveBeenCalledWith(
        updateDto.updates,
        updateDto.options,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Updated 2 out of 2 users');
    });

    it('should handle empty updates', async () => {
      const updateDto = {
        updates: [],
      };

      const result = await controller.updateUsersBatch(updateDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No user updates provided');
      expect(mockBatchService.updateUsers).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteUsersBatch', () => {
    it('should soft delete users successfully', async () => {
      const deleteDto = {
        userIds: ['uuid1', 'uuid2'],
        options: {
          chunkSize: 100,
        },
      };

      const mockResult: BatchOperationResult<string> = {
        successful: ['uuid1', 'uuid2'],
        failed: [],
        stats: {
          total: 2,
          successful: 2,
          failed: 0,
        },
      };

      mockBatchService.softDeleteUsers.mockResolvedValue(mockResult);

      const result = await controller.softDeleteUsersBatch(deleteDto);

      expect(mockBatchService.softDeleteUsers).toHaveBeenCalledWith(
        deleteDto.userIds,
        deleteDto.options,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Soft deleted 2 out of 2 users');
    });

    it('should handle empty userIds', async () => {
      const deleteDto = {
        userIds: [],
      };

      const result = await controller.softDeleteUsersBatch(deleteDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No user IDs provided');
      expect(mockBatchService.softDeleteUsers).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        hits: 100,
        misses: 20,
        hitRate: 0.83,
        totalKeys: 50,
      };

      const result = await controller.getCacheStats();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        cacheType: 'Redis',
        status: 'active',
      });
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('warmUpCache', () => {
    it('should warm up cache successfully', async () => {
      const warmUpDto = {
        userIds: ['uuid1', 'uuid2', 'uuid3'],
      };

      const mockUsersMap = new Map([
        ['uuid1', { id: 'uuid1' } as User],
        ['uuid2', { id: 'uuid2' } as User],
        ['uuid3', { id: 'uuid3' } as User],
      ]);
      mockBatchService.getUsersByIds.mockResolvedValue(mockUsersMap);

      const result = await controller.warmUpCache(warmUpDto);

      expect(mockBatchService.getUsersByIds).toHaveBeenCalledWith(
        warmUpDto.userIds,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Cache warmed up for 3 users');
    });

    it('should handle empty userIds', async () => {
      const warmUpDto = {
        userIds: [],
      };

      const result = await controller.warmUpCache(warmUpDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No user IDs provided for cache warm-up');
      expect(mockBatchService.getUsersByIds).not.toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      const result = await controller.clearCache();

      expect(mockCacheService.redisService.getClient).toHaveBeenCalled();
      expect(mockCacheService.redisService.getClient().flushdb).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('User cache cleared successfully');
      expect(result.timestamp).toBeDefined();
    });
  });
});
