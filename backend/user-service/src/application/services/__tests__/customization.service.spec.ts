import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomizationService, CustomizationPreferences } from '../customization.service';
import { User } from '../../../domain/entities/user.entity';
import { EventPublisher } from '../../events/event-publisher.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CustomizationService', () => {
  let service: CustomizationService;
  let userRepository: jest.Mocked<Repository<User>>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  // Создаем правильный мок User с учетом Value Objects
  const createMockUser = (overrides: Partial<any> = {}): any => ({
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    customizationPreferences: null,
    // Добавляем недостающие свойства и методы для совместимости с TypeORM
    _emailVO: null,
    _usernameVO: null,
    _passwordVO: null,
    getEmail: jest.fn(),
    setEmail: jest.fn(),
    getUsername: jest.fn(),
    setUsername: jest.fn(),
    validatePassword: jest.fn(),
    setPassword: jest.fn(),
    ...overrides,
  });

  const mockUser = createMockUser();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomizationService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EventPublisher,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CustomizationService>(CustomizationService);
    userRepository = module.get(getRepositoryToken(User));
    eventPublisher = module.get(EventPublisher);
  });

  describe('getUserCustomization', () => {
    it('should return user customization preferences', async () => {
      // Arrange
      const mockPreferences: CustomizationPreferences = {
        theme: {
          name: 'Dark',
          primaryColor: '#0d6efd',
          secondaryColor: '#6c757d',
          backgroundColor: '#212529',
          textColor: '#ffffff',
          accentColor: '#20c997',
          borderRadius: 6,
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          darkMode: true,
        },
        widgets: [],
        layout: { template: 'modern', sections: { header: true, sidebar: true, mainContent: true, footer: true } },
        privacy: { showOnlineStatus: true, showGameActivity: true, showAchievements: true, showFriends: true },
        notifications: {
          emailNotifications: true,
          pushNotifications: true,
          gameUpdates: true,
          friendRequests: true,
          achievements: true,
        },
        accessibility: { highContrast: false, largeText: false, reducedMotion: false, screenReader: false },
      };

      const userWithPreferences = createMockUser({ customizationPreferences: mockPreferences });
      userRepository.findOneBy.mockResolvedValue(userWithPreferences);

      // Act
      const result = await service.getUserCustomization('user-123');

      // Assert
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-123' });
      expect(result).toEqual(mockPreferences);
    });

    it('should return default customization when user has no preferences', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserCustomization('user-123');

      // Assert
      expect(result.theme.name).toBe('Default');
      expect(result.widgets).toHaveLength(3); // Default widgets
      expect(result.layout.template).toBe('classic');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserCustomization('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserCustomization', () => {
    it('should update user customization preferences', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      const updates = {
        theme: {
          name: 'Dark',
          primaryColor: '#0d6efd',
          backgroundColor: '#212529',
          textColor: '#ffffff',
          secondaryColor: '#6c757d',
          accentColor: '#20c997',
          borderRadius: 6,
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          darkMode: true,
        },
      };

      // Act
      const result = await service.updateUserCustomization('user-123', updates);

      // Assert
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-123' });
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('user.customization.updated', expect.any(Object));
      expect(result.theme.name).toBe('Dark');
    });

    it('should throw BadRequestException for invalid color format', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      const invalidUpdates = {
        theme: {
          name: 'Invalid',
          primaryColor: 'invalid-color',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          secondaryColor: '#6c757d',
          accentColor: '#20c997',
          borderRadius: 6,
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          darkMode: false,
        },
      };

      // Act & Assert
      await expect(service.updateUserCustomization('user-123', invalidUpdates)).rejects.toThrow(BadRequestException);
    });
  });

  describe('applyPredefinedTheme', () => {
    it('should apply predefined theme successfully', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      // Act
      const result = await service.applyPredefinedTheme('user-123', 'dark');

      // Assert
      expect(result.theme.name).toBe('Dark');
      expect(result.theme.darkMode).toBe(true);
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-existent theme', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.applyPredefinedTheme('user-123', 'non-existent')).rejects.toThrow(BadRequestException);
    });
  });

  describe('addWidget', () => {
    it('should add widget successfully', async () => {
      // Arrange
      const userWithPreferences = createMockUser({
        customizationPreferences: {
          widgets: [],
          theme: service.getAvailableThemes().default,
          layout: { template: 'classic', sections: { header: true, sidebar: true, mainContent: true, footer: true } },
          privacy: { showOnlineStatus: true, showGameActivity: true, showAchievements: true, showFriends: true },
          notifications: {
            emailNotifications: true,
            pushNotifications: true,
            gameUpdates: true,
            friendRequests: true,
            achievements: true,
          },
          accessibility: { highContrast: false, largeText: false, reducedMotion: false, screenReader: false },
        },
      });

      userRepository.findOneBy.mockResolvedValue(userWithPreferences);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      // Act
      const result = await service.addWidget('user-123', 'game_library', { x: 0, y: 0 });

      // Assert
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].type).toBe('game_library');
      expect(result.widgets[0].position).toEqual({ x: 0, y: 0 });
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid widget type', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.addWidget('user-123', 'invalid_widget', { x: 0, y: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when maximum widgets reached', async () => {
      // Arrange
      const widgets = Array.from({ length: 12 }, (_, i) => ({
        id: `widget-${i}`,
        type: 'game_library' as const,
        position: { x: i * 10, y: 0 },
        size: { width: 100, height: 100 },
        visible: true,
        settings: {},
        order: i,
      }));

      const userWithMaxWidgets = createMockUser({
        customizationPreferences: {
          widgets,
          theme: service.getAvailableThemes().default,
          layout: { template: 'classic', sections: { header: true, sidebar: true, mainContent: true, footer: true } },
          privacy: { showOnlineStatus: true, showGameActivity: true, showAchievements: true, showFriends: true },
          notifications: {
            emailNotifications: true,
            pushNotifications: true,
            gameUpdates: true,
            friendRequests: true,
            achievements: true,
          },
          accessibility: { highContrast: false, largeText: false, reducedMotion: false, screenReader: false },
        },
      });

      userRepository.findOneBy.mockResolvedValue(userWithMaxWidgets);

      // Act & Assert
      await expect(service.addWidget('user-123', 'achievements', { x: 0, y: 0 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeWidget', () => {
    it('should remove widget successfully', async () => {
      // Arrange
      const userWithWidget = createMockUser({
        customizationPreferences: {
          widgets: [
            {
              id: 'widget-1',
              type: 'game_library' as const,
              position: { x: 0, y: 0 },
              size: { width: 100, height: 100 },
              visible: true,
              settings: {},
              order: 0,
            },
          ],
          theme: service.getAvailableThemes().default,
          layout: { template: 'classic', sections: { header: true, sidebar: true, mainContent: true, footer: true } },
          privacy: { showOnlineStatus: true, showGameActivity: true, showAchievements: true, showFriends: true },
          notifications: {
            emailNotifications: true,
            pushNotifications: true,
            gameUpdates: true,
            friendRequests: true,
            achievements: true,
          },
          accessibility: { highContrast: false, largeText: false, reducedMotion: false, screenReader: false },
        },
      });

      userRepository.findOneBy.mockResolvedValue(userWithWidget);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      // Act
      const result = await service.removeWidget('user-123', 'widget-1');

      // Assert
      expect(result.widgets).toHaveLength(0);
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent widget', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.removeWidget('user-123', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetToDefault', () => {
    it('should reset customization to default', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      // Act
      const result = await service.resetToDefault('user-123');

      // Assert
      expect(result.theme.name).toBe('Default');
      expect(result.widgets).toHaveLength(3); // Default widgets
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith('user.customization.reset', expect.any(Object));
    });
  });

  describe('exportUserCustomization', () => {
    it('should export user customization as JSON string', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act
      const result = await service.exportUserCustomization('user-123');

      // Assert
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('importUserCustomization', () => {
    it('should import valid customization data', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);
      const savedUser = createMockUser();
      userRepository.save.mockResolvedValue(savedUser);

      const validCustomizationData = JSON.stringify({
        theme: service.getAvailableThemes().dark,
        widgets: [],
        layout: { template: 'modern', sections: { header: true, sidebar: true, mainContent: true, footer: true } },
        privacy: { showOnlineStatus: true, showGameActivity: true, showAchievements: true, showFriends: true },
        notifications: {
          emailNotifications: true,
          pushNotifications: true,
          gameUpdates: true,
          friendRequests: true,
          achievements: true,
        },
        accessibility: { highContrast: false, largeText: false, reducedMotion: false, screenReader: false },
      });

      // Act
      const result = await service.importUserCustomization('user-123', validCustomizationData);

      // Assert
      expect(result.theme.name).toBe('Dark');
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid JSON', async () => {
      // Arrange
      userRepository.findOneBy.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.importUserCustomization('user-123', 'invalid-json')).rejects.toThrow(BadRequestException);
    });
  });
});
