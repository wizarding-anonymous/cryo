import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchService } from './batch.service';
import { User } from './entities/user.entity';
import { CacheService } from '../common/cache/cache.service';
import { SecurityClient } from '../integrations/security/security.client';
import { CreateUserDto } from './dto/create-user.dto';

describe('BatchService', () => {
  let service: BatchService;
  let userRepository: jest.Mocked<Repository<User>>;
  let cacheService: jest.Mocked<CacheService>;
  let securityClient: jest.Mocked<SecurityClient>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    avatarUrl: null,
    preferences: null,
    privacySettings: null,
    isActive: true,
    metadata: null,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      preload: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    const mockCacheService = {
      getUsersBatch: jest.fn(),
      setUser: jest.fn(),
      setUsersBatch: jest.fn(),
      invalidateUser: jest.fn(),
    };

    const mockSecurityClient = {
      logSecurityEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: SecurityClient,
          useValue: mockSecurityClient,
        },
        {
          provide: 'MetricsService',
          useValue: {
            incrementCounter: jest.fn(),
            recordHistogram: jest.fn(),
            setGauge: jest.fn(),
            getMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    userRepository = module.get(getRepositoryToken(User));
    cacheService = module.get(CacheService);
    securityClient = module.get(SecurityClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUsers', () => {
    it('should create users successfully', async () => {
      const createUserDtos: CreateUserDto[] = [
        { email: 'user1@example.com', name: 'User 1', password: 'hashedpass1' },
        { email: 'user2@example.com', name: 'User 2', password: 'hashedpass2' },
      ];

      userRepository.findOne.mockResolvedValue(null); // No existing users
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      cacheService.setUsersBatch.mockResolvedValue(undefined);
      securityClient.logSecurityEvent.mockResolvedValue(undefined);

      const result = await service.createUsers(createUserDtos);

      expect(result.stats.total).toBe(2);
      expect(result.stats.successful).toBe(2);
      expect(result.stats.failed).toBe(0);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle validation errors', async () => {
      const invalidDtos: CreateUserDto[] = [
        { email: 'invalid-email', name: 'User 1', password: 'hashedpass1' },
        { email: 'user2@example.com', name: '', password: 'hashedpass2' },
      ];

      const result = await service.createUsers(invalidDtos);

      expect(result.stats.total).toBe(2);
      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(2);
      expect(result.failed).toHaveLength(2);
    });

    it('should handle existing users', async () => {
      const createUserDtos: CreateUserDto[] = [
        {
          email: 'existing@example.com',
          name: 'User 1',
          password: 'hashedpass1',
        },
      ];

      userRepository.findOne.mockResolvedValue(mockUser); // User exists

      const result = await service.createUsers(createUserDtos);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe(
        'User with this email already exists',
      );
    });

    it('should process in chunks', async () => {
      const createUserDtos: CreateUserDto[] = Array.from(
        { length: 250 },
        (_, i) => ({
          email: `user${i}@example.com`,
          name: `User ${i}`,
          password: 'hashedpass',
        }),
      );

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      cacheService.setUsersBatch.mockResolvedValue(undefined);

      const result = await service.createUsers(createUserDtos, {
        chunkSize: 100,
      });

      expect(result.stats.total).toBe(250);
      expect(result.stats.successful).toBe(250);
      // Should have processed in 3 chunks (100, 100, 50)
      expect(userRepository.save).toHaveBeenCalledTimes(250);
    });
  });

  describe('getUsersByIds', () => {
    it('should get users from cache and database', async () => {
      const userIds = [
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
        '123e4567-e89b-12d3-a456-426614174003',
      ];
      const cachedUsers = new Map([
        [
          '123e4567-e89b-12d3-a456-426614174001',
          { ...mockUser, id: '123e4567-e89b-12d3-a456-426614174001' },
        ],
      ]);
      const dbUsers = [
        { ...mockUser, id: '123e4567-e89b-12d3-a456-426614174002' },
        { ...mockUser, id: '123e4567-e89b-12d3-a456-426614174003' },
      ];

      cacheService.getUsersBatch.mockResolvedValue(cachedUsers);
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(dbUsers),
      } as any;
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      cacheService.setUser.mockResolvedValue(undefined);

      const result = await service.getUsersByIds(userIds);

      expect(result.size).toBe(3);
      expect(result.has('123e4567-e89b-12d3-a456-426614174001')).toBe(true);
      expect(result.has('123e4567-e89b-12d3-a456-426614174002')).toBe(true);
      expect(result.has('123e4567-e89b-12d3-a456-426614174003')).toBe(true);
    });

    it('should handle invalid UUIDs', async () => {
      const userIds = ['invalid-uuid', 'another-invalid'];

      const result = await service.getUsersByIds(userIds);

      expect(result.size).toBe(0);
      expect(cacheService.getUsersBatch).not.toHaveBeenCalled();
    });

    it('should process in chunks', async () => {
      const userIds = Array.from(
        { length: 250 },
        (_, i) =>
          `123e4567-e89b-12d3-a456-${(426614174000 + i).toString().padStart(12, '0')}`,
      );

      cacheService.getUsersBatch.mockResolvedValue(new Map());
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any;
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUsersByIds(userIds, { chunkSize: 100 });

      // Should have been called 3 times for 3 chunks (100, 100, 50)
      expect(userRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateUsers', () => {
    it('should update users successfully', async () => {
      const updates = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          data: { name: 'Updated Name 1' },
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          data: { name: 'Updated Name 2' },
        },
      ];

      userRepository.findOne.mockResolvedValue(null); // No email conflicts
      userRepository.preload.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      cacheService.invalidateUser.mockResolvedValue(undefined);

      const result = await service.updateUsers(updates);

      expect(result.stats.successful).toBe(2);
      expect(result.stats.failed).toBe(0);
    });

    it('should handle email conflicts', async () => {
      const updates = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          data: { email: 'existing@example.com' },
        },
      ];

      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        id: 'different-id',
      });

      const result = await service.updateUsers(updates);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe('Email already used by another user');
    });

    it('should reject password updates', async () => {
      const updates = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          data: { password: 'newpassword' } as any,
        },
      ];

      const result = await service.updateUsers(updates);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe(
        'Password updates must be handled by authentication service',
      );
    });
  });

  describe('softDeleteUsers', () => {
    it('should soft delete users successfully', async () => {
      const userIds = [
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
      ];

      userRepository.softDelete.mockResolvedValue({
        affected: 2,
        raw: {},
        generatedMaps: [],
      });
      cacheService.invalidateUser.mockResolvedValue(undefined);
      securityClient.logSecurityEvent.mockResolvedValue(undefined);

      const result = await service.softDeleteUsers(userIds);

      expect(result.stats.successful).toBe(2);
      expect(result.stats.failed).toBe(0);
      expect(result.successful).toEqual(userIds);
    });

    it('should handle invalid UUIDs', async () => {
      const userIds = ['invalid-uuid'];

      const result = await service.softDeleteUsers(userIds);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe('Invalid UUID format');
    });

    it('should handle users not found', async () => {
      const userIds = ['123e4567-e89b-12d3-a456-426614174000'];

      userRepository.softDelete.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      });
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.softDeleteUsers(userIds, {
        continueOnError: true,
      });

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe('User not found');
    });
  });

  describe('processInChunks', () => {
    it('should process items in chunks', async () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue('processed');

      const results = await service.processInChunks(items, 100, processor);

      expect(results).toHaveLength(3); // 3 chunks
      expect(processor).toHaveBeenCalledTimes(3);
      expect(processor).toHaveBeenNthCalledWith(1, items.slice(0, 100));
      expect(processor).toHaveBeenNthCalledWith(2, items.slice(100, 200));
      expect(processor).toHaveBeenNthCalledWith(3, items.slice(200, 250));
    });

    it('should handle processor errors', async () => {
      const items = [1, 2, 3];
      const processor = jest
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      await expect(
        service.processInChunks(items, 2, processor),
      ).rejects.toThrow('Processing failed');
    });
  });
});
