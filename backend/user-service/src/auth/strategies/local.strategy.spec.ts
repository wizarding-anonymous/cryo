import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../user/entities/user.entity';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockUser: Omit<User, 'password'> = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      validateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
      authService.validateUser.mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate(email, password);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'wrongpassword';
      authService.validateUser.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(email, password)).rejects.toThrow(
        'Неверный email или пароль',
      );
      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      const password = 'password123';
      authService.validateUser.mockResolvedValue(null);

      // Act & Assert
      await expect(strategy.validate(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });

    it('should handle AuthService errors gracefully', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
      const error = new Error('Database connection failed');
      authService.validateUser.mockRejectedValue(error);

      // Act & Assert
      await expect(strategy.validate(email, password)).rejects.toThrow(error);
      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
    });
  });
});
