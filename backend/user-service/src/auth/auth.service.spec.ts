import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationClient } from '../integrations/notification/notification.client';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';

// Mock implementations for all dependencies
const mockUserService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  decode: jest.fn(),
};

const mockCacheManager = {
  set: jest.fn(),
  get: jest.fn(),
};

const mockNotificationClient = {
  sendWelcomeNotification: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: NotificationClient, useValue: mockNotificationClient },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully and return a token', async () => {
      const registerDto = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      const createdUser: User = { id: 'a-uuid', ...registerDto, createdAt: new Date(), updatedAt: new Date() };

      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(createdUser);
      mockJwtService.signAsync.mockResolvedValue('mock_access_token');

      const result = await service.register(registerDto);

      expect(mockUserService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockUserService.create).toHaveBeenCalledWith(registerDto);
      expect(mockNotificationClient.sendWelcomeNotification).toHaveBeenCalledWith(createdUser.id, createdUser.email);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({ sub: createdUser.id, email: createdUser.email });
      expect(result).toHaveProperty('accessToken', 'mock_access_token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw a ConflictException if the email already exists', async () => {
      const registerDto = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      mockUserService.findByEmail.mockResolvedValue({} as User); // Simulate user found

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return the user object if credentials are valid', async () => {
      const email = 'test@example.com';
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user: User = { id: 'a-uuid', email, password: hashedPassword, name: 'Test User', createdAt: new Date(), updatedAt: new Date() };

      mockUserService.findByEmail.mockResolvedValue(user);

      const result = await service.validateUser(email, plainPassword);
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result.id).toEqual(user.id);
    });

    it('should return null if the user is not found', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      const result = await service.validateUser('notfound@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('should return null if the password does not match', async () => {
      const email = 'test@example.com';
      const plainPassword = 'password123';
      const wrongPassword = 'wrong_password';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const user: User = { id: 'a-uuid', email, password: hashedPassword, name: 'Test User', createdAt: new Date(), updatedAt: new Date() };

      mockUserService.findByEmail.mockResolvedValue(user);

      const result = await service.validateUser(email, wrongPassword);
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should add the token to the cache blacklist with the correct TTL', async () => {
      const token = 'some.jwt.token';
      const now = Date.now();
      const exp = (now / 1000) + 3600; // Expires in 1 hour
      const decoded = { exp };
      mockJwtService.decode.mockReturnValue(decoded);

      await service.logout(token);

      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
      const expectedTtl = (decoded.exp * 1000) - now;
      // Check that the TTL is approximately correct
      expect(mockCacheManager.set).toHaveBeenCalledWith(token, 'blacklisted', expect.any(Number));
      const actualTtl = mockCacheManager.set.mock.calls[0][2];
      expect(actualTtl).toBeGreaterThan(expectedTtl - 1000); // Allow for small delay
      expect(actualTtl).toBeLessThanOrEqual(expectedTtl);
    });

    it('should not add to cache if token is already expired', async () => {
      const token = 'some.jwt.token';
      const exp = (Date.now() / 1000) - 3600; // Expired 1 hour ago
      const decoded = { exp };
      mockJwtService.decode.mockReturnValue(decoded);

      await service.logout(token);

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });
});
