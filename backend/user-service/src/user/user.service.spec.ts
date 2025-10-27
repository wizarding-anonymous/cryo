import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { SecurityClient } from '../integrations/security/security.client';
import { IntegrationService } from '../integrations/integration.service';
import { CacheService } from '../common/cache/cache.service';
import { BatchService } from './batch.service';
import { NotFoundException } from '@nestjs/common';
import { LoggingService } from '../common/logging/logging.service';
import { AuditService } from '../common/logging/audit.service';
import { PaginationService } from '../common/services/pagination.service';
import { UserEncryptionService } from './services/user-encryption.service';
import { UserServiceError } from '../common/errors/user-service.error';

// Mock implementations for dependencies
const mockUserRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  preload: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};

const mockSecurityClient = {
  logSecurityEvent: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: SecurityClient,
          useValue: mockSecurityClient,
        },
        {
          provide: IntegrationService,
          useValue: {
            notifyUserCreated: jest.fn().mockResolvedValue(undefined),
            notifyUserUpdated: jest.fn().mockResolvedValue(undefined),
            notifyUserDeleted: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getUser: jest.fn(),
            setUser: jest.fn(),
            invalidateUser: jest.fn(),
            getUsersBatch: jest.fn().mockResolvedValue(new Map()),
            setUsersBatch: jest.fn(),
            warmUpCache: jest.fn(),
            clearCache: jest.fn(),
            getCacheStats: jest.fn(),
          },
        },
        {
          provide: BatchService,
          useValue: {
            getUsersByIds: jest.fn(),
            createUsers: jest.fn(),
            updateUsers: jest.fn(),
            softDeleteUsers: jest.fn(),
          },
        },
        {
          provide: LoggingService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            logDatabaseOperation: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logAuditEvent: jest.fn(),
            logDataAccess: jest.fn(),
            logUserOperation: jest.fn(),
            logEnhancedDataAccess: jest.fn(),
          },
        },
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn(),
            createPaginationResponse: jest.fn(),
          },
        },
        {
          provide: UserEncryptionService,
          useValue: {
            encryptUserData: jest.fn(),
            decryptUserData: jest.fn(),
            prepareUserForSave: jest.fn((user) => user),
            prepareUserAfterLoad: jest.fn((user) => user),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with pre-hashed password from calling service', async () => {
      const createUserDto = {
        name: 'Test',
        email: 'test@example.com',
        password:
          '$2b$10$hashedPasswordFromCallingServiceWithProperLength123456', // Already hashed by calling service
      };
      const userEntity = { ...createUserDto };
      const savedUser = { id: 'a-uuid', ...userEntity };

      mockUserRepository.create.mockReturnValue(userEntity);
      mockUserRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(createUserDto);

      // Password should NOT be hashed again since it comes pre-hashed from calling service
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        name: createUserDto.name,
        email: createUserDto.email,
        password: createUserDto.password, // Should use the already hashed password
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(userEntity);
      expect(mockSecurityClient.logSecurityEvent).toHaveBeenCalled();
      expect(result).toEqual(savedUser);
    });
  });

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      const email = 'test@example.com';
      const user = { id: 'a-uuid', email };
      mockUserRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.findByEmail(email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a user successfully', async () => {
      const userId = 'a-uuid';
      const mockUser = { id: userId, name: 'Test', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete(userId);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      const userId = 'a-uuid';
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(userId)).rejects.toThrow(UserServiceError);
    });
  });
});
