import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { AuditService } from '../common/logging/audit.service';
import { LoggingService } from '../common/logging/logging.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          INTERNAL_API_KEYS: 'test-api-key',
          INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
          INTERNAL_SERVICE_SECRET: 'test-secret',
          NODE_ENV: 'test',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
          provide: LoggingService,
          useValue: {
            log: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            logSecurityEvent: jest.fn(),
          },
        },
        InternalServiceGuard,
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InternalServiceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword123',
      };

      mockUserService.create.mockResolvedValue(mockUser);

      const mockAuditContext = { correlationId: 'test-correlation-id', userId: 'test-user' };
      const result = await controller.createUser(createUserDto, mockAuditContext);

      expect(userService.create).toHaveBeenCalledWith(createUserDto, 'test-correlation-id', undefined, undefined);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const email = 'test@example.com';
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      const mockAuditContext = { correlationId: 'test-correlation-id', userId: 'test-user' };
      const result = await controller.findByEmail({ email }, mockAuditContext);

      expect(userService.findByEmail).toHaveBeenCalledWith(email, 'test-correlation-id');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const email = 'notfound@example.com';
      mockUserService.findByEmail.mockResolvedValue(null);

      const mockAuditContext = { correlationId: 'test-correlation-id', userId: 'test-user' };
      await expect(controller.findByEmail({ email }, mockAuditContext)).rejects.toThrow(
        'Пользователь с ID notfound@example.com не найден',
      );
      expect(userService.findByEmail).toHaveBeenCalledWith(email, 'test-correlation-id');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.findById.mockResolvedValue(mockUser);

      const mockAuditContext = { correlationId: 'test-correlation-id', userId: 'test-user' };
      const result = await controller.findById(params, mockAuditContext);

      expect(userService.findById).toHaveBeenCalledWith(userId, 'test-correlation-id');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'nonexistent-id';
      const params = { id: userId };
      mockUserService.findById.mockResolvedValue(null);

      const mockAuditContext = { correlationId: 'test-correlation-id', userId: 'test-user' };
      await expect(controller.findById(params, mockAuditContext)).rejects.toThrow(
        'Пользователь с ID nonexistent-id не найден',
      );
      expect(userService.findById).toHaveBeenCalledWith(userId, 'test-correlation-id');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.updateLastLogin.mockResolvedValue(undefined);

      const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
      const result = await controller.updateLastLogin(params, mockRequest);

      expect(userService.updateLastLogin).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ message: 'Last login updated successfully' });
    });
  });

  describe('checkUserExists', () => {
    it('should check if user exists', async () => {
      const userId = mockUser.id;
      const params = { id: userId };
      mockUserService.exists.mockResolvedValue(true);

      const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
      const result = await controller.checkUserExists(params, mockRequest);

      expect(userService.exists).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ exists: true });
    });
  });
});
