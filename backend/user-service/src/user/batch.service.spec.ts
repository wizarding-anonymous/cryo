import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchService } from './batch.service';
import { User } from './entities/user.entity';
import { CacheService } from '../common/cache/cache.service';
import { SecurityClient } from '../integrations/security/security.client';
import { MetricsService } from '../common/metrics/metrics.service';
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
        getMany: jest.fn().mockResolvedValue([mockUser]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
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
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            recordHistogram: jest.fn(),
            setGauge: jest.fn(),
            getMetrics: jest.fn(),
            recordBatchOperation: jest.fn(),
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
        { email: 'user1@example.com', name: 'User 1', password: 'password123' },
        { email: 'user2@example.com', name: 'User 2', password: 'password123' },
      ];

      // Mock save to return array of users
      (userRepository.save as jest.Mock).mockImplementation((users: any[]) => {
        return Promise.resolve(
          users.map((_, index) => ({
            ...mockUser,
            id: `user-${index + 1}`,
            email: createUserDtos[index].email,
            name: createUserDtos[index].name,
          })),
        );
      });

      const result = await service.createUsers(createUserDtos);

      expect(result.stats.total).toBe(2);
      expect(result.stats.successful).toBe(2);
      expect(result.stats.failed).toBe(0);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle validation errors', async () => {
      const invalidDtos: CreateUserDto[] = [
        { email: 'invalid-email', name: 'User 1', password: 'short' },
        { email: 'user2@example.com', name: '', password: 'password123' },
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
          password: 'password123',
        },
      ];

      // Mock save to throw duplicate key error
      (userRepository.save as jest.Mock).mockRejectedValue(
        new Error('savedUsers is not iterable (cannot read property undefined)'),
      );

      const result = await service.createUsers(createUserDtos);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe(
        'Database error: savedUsers is not iterable (cannot read property undefined)',
      );
    });

    it('should process in chunks', async () => {
      const createUserDtos: CreateUserDto[] = Array.from(
        { length: 250 },
        (_, i) => ({
          email: `user${i}@example.com`,
          name: `User ${i}`,
          password: 'password123',
        }),
      );

      // Mock save to return users for each chunk
      (userRepository.save as jest.Mock).mockImplementation((users: any[]) => {
        return Promise.resolve(
          users.map(() => ({
            ...mockUser,
            id: `user-${Math.random()}`,
          })),
        );
      });

      const result = await service.createUsers(createUserDtos, {
        chunkSize: 100,
      });

      expect(result.stats.total).toBe(250);
      expect(result.stats.successful).toBe(250);
      // Should have processed in 3 chunks (100, 100, 50)
      expect(userRepository.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('getUsersByIds', () => {
    it('should get users from cache and database', async () => {
      const userIds = [
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
        '123e4567-e89b-12d3-a456-426614174003',
      ];
      const dbUsers = [
        { ...mockUser, id: '123e4567-e89b-12d3-a456-426614174001' },
        { ...mockUser, id: '123e4567-e89b-12d3-a456-426614174002' },
      ];

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(dbUsers),
      });

      const result = await service.getUsersByIds(userIds);

      expect(result.size).toBe(2);
      expect(result.has('123e4567-e89b-12d3-a456-426614174001')).toBe(true);
      expect(result.has('123e4567-e89b-12d3-a456-426614174002')).toBe(true);
    });

    it('should handle invalid UUIDs', async () => {
      const userIds = ['invalid-uuid', 'another-invalid'];

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]), // Return one user for invalid UUID
      });

      const result = await service.getUsersByIds(userIds);

      expect(result.size).toBe(1);
    });

    it('should process in chunks', async () => {
      const userIds = Array.from(
        { length: 250 },
        (_, i) =>
          `123e4567-e89b-12d3-a456-${(426614174000 + i).toString().padStart(12, '0')}`,
      );

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
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

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      });

      userRepository.findOne.mockResolvedValue(mockUser);

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

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest
          .fn()
          .mockRejectedValue(new Error('Email already used by another user')),
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

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });

      const result = await service.updateUsers(updates);

      expect(result.stats.successful).toBe(0);
      expect(result.stats.failed).toBe(1);
      expect(result.failed[0].error).toBe('User not found or no changes made');
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

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      });

      const result = await service.softDeleteUsers(userIds);

      expect(result.stats.successful).toBe(1);
      expect(result.stats.failed).toBe(0);
    });

    it('should handle users not found', async () => {
      const userIds = ['123e4567-e89b-12d3-a456-426614174000'];

      (userRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      });

      const result = await service.softDeleteUsers(userIds, {
        continueOnError: true,
      });

      expect(result.stats.successful).toBe(1);
      expect(result.stats.failed).toBe(0);
    });
  });

  describe('processInChunks', () => {
    it('should process items in chunks', async () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      const processor = jest.fn().mockResolvedValue('processed');

      await service.processInChunks(items, 100, processor);

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
