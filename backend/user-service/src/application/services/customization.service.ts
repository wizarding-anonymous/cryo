import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';

export interface ThemeConfiguration {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  fontFamily: string;
  fontSize: number;
  darkMode: boolean;
}

export interface WidgetConfiguration {
  id: string;
  type: 'game_library' | 'achievements' | 'friends' | 'activity_feed' | 'statistics' | 'news' | 'custom';
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  settings: Record<string, any>;
  order: number;
}

export interface ProfileLayout {
  template: 'classic' | 'modern' | 'minimal' | 'gaming' | 'professional';
  sections: {
    header: boolean;
    sidebar: boolean;
    mainContent: boolean;
    footer: boolean;
  };
  customCSS?: string;
}

export interface CustomizationPreferences {
  theme: ThemeConfiguration;
  widgets: WidgetConfiguration[];
  layout: ProfileLayout;
  privacy: {
    showOnlineStatus: boolean;
    showGameActivity: boolean;
    showAchievements: boolean;
    showFriends: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    gameUpdates: boolean;
    friendRequests: boolean;
    achievements: boolean;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
  };
}

@Injectable()
export class CustomizationService {
  private readonly logger = new Logger(CustomizationService.name);

  // Предустановленные темы
  private readonly predefinedThemes: Record<string, ThemeConfiguration> = {
    default: {
      name: 'Default',
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      backgroundColor: '#ffffff',
      textColor: '#212529',
      accentColor: '#28a745',
      borderRadius: 4,
      fontFamily: 'Inter, sans-serif',
      fontSize: 14,
      darkMode: false,
    },
    dark: {
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
    gaming: {
      name: 'Gaming',
      primaryColor: '#ff6b35',
      secondaryColor: '#4ecdc4',
      backgroundColor: '#1a1a2e',
      textColor: '#eee',
      accentColor: '#ff6b35',
      borderRadius: 8,
      fontFamily: 'Orbitron, monospace',
      fontSize: 15,
      darkMode: true,
    },
    professional: {
      name: 'Professional',
      primaryColor: '#2c3e50',
      secondaryColor: '#95a5a6',
      backgroundColor: '#ecf0f1',
      textColor: '#2c3e50',
      accentColor: '#3498db',
      borderRadius: 2,
      fontFamily: 'Roboto, sans-serif',
      fontSize: 13,
      darkMode: false,
    },
  };

  // Доступные виджеты
  private readonly availableWidgets: Record<string, Omit<WidgetConfiguration, 'id' | 'position' | 'order'>> = {
    game_library: {
      type: 'game_library',
      size: { width: 300, height: 200 },
      visible: true,
      settings: { showRecentGames: true, maxGames: 6 },
    },
    achievements: {
      type: 'achievements',
      size: { width: 250, height: 150 },
      visible: true,
      settings: { showProgress: true, maxAchievements: 5 },
    },
    friends: {
      type: 'friends',
      size: { width: 200, height: 300 },
      visible: true,
      settings: { showOnlineOnly: false, maxFriends: 10 },
    },
    activity_feed: {
      type: 'activity_feed',
      size: { width: 400, height: 250 },
      visible: true,
      settings: { showGameActivity: true, showAchievements: true, maxItems: 8 },
    },
    statistics: {
      type: 'statistics',
      size: { width: 300, height: 180 },
      visible: true,
      settings: { showPlayTime: true, showGamesCount: true, showAchievementRate: true },
    },
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * Получение настроек кастомизации пользователя
   */
  async getUserCustomization(userId: string): Promise<CustomizationPreferences> {
    this.logger.log(`Getting customization preferences for user ${userId}`);

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Если у пользователя нет настроек, возвращаем дефолтные
    if (!user.customizationPreferences) {
      return this.getDefaultCustomization();
    }

    return user.customizationPreferences as CustomizationPreferences;
  }

  /**
   * Обновление настроек кастомизации пользователя
   */
  async updateUserCustomization(
    userId: string,
    preferences: Partial<CustomizationPreferences>,
  ): Promise<CustomizationPreferences> {
    this.logger.log(`Updating customization preferences for user ${userId}`);

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Получаем текущие настройки или дефолтные
    const currentPreferences =
      (user.customizationPreferences as CustomizationPreferences) || this.getDefaultCustomization();

    // Мержим с новыми настройками
    const updatedPreferences: CustomizationPreferences = {
      theme: { ...currentPreferences.theme, ...preferences.theme },
      widgets: preferences.widgets || currentPreferences.widgets,
      layout: { ...currentPreferences.layout, ...preferences.layout },
      privacy: { ...currentPreferences.privacy, ...preferences.privacy },
      notifications: { ...currentPreferences.notifications, ...preferences.notifications },
      accessibility: { ...currentPreferences.accessibility, ...preferences.accessibility },
    };

    // Валидация настроек
    this.validateCustomizationPreferences(updatedPreferences);

    // Сохраняем
    user.customizationPreferences = updatedPreferences;
    await this.userRepository.save(user);

    // Публикуем событие
    await this.eventPublisher.publish('user.customization.updated', {
      userId,
      changedFields: Object.keys(preferences),
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Customization preferences updated for user ${userId}`);
    return updatedPreferences;
  }

  /**
   * Применение предустановленной темы
   */
  async applyPredefinedTheme(userId: string, themeName: string): Promise<CustomizationPreferences> {
    this.logger.log(`Applying predefined theme ${themeName} for user ${userId}`);

    const theme = this.predefinedThemes[themeName];
    if (!theme) {
      throw new BadRequestException(`Theme ${themeName} not found`);
    }

    return await this.updateUserCustomization(userId, { theme });
  }

  /**
   * Получение списка доступных тем
   */
  getAvailableThemes(): Record<string, ThemeConfiguration> {
    return this.predefinedThemes;
  }

  /**
   * Добавление виджета в профиль
   */
  async addWidget(
    userId: string,
    widgetType: string,
    position: { x: number; y: number },
  ): Promise<CustomizationPreferences> {
    this.logger.log(`Adding widget ${widgetType} for user ${userId}`);

    const widgetTemplate = this.availableWidgets[widgetType];
    if (!widgetTemplate) {
      throw new BadRequestException(`Widget type ${widgetType} not available`);
    }

    const currentPreferences = await this.getUserCustomization(userId);

    // Создаем новый виджет
    const newWidget: WidgetConfiguration = {
      id: `${widgetType}_${Date.now()}`,
      ...widgetTemplate,
      position,
      order: currentPreferences.widgets.length,
    };

    // Проверяем лимиты (максимум 12 виджетов)
    if (currentPreferences.widgets.length >= 12) {
      throw new BadRequestException('Maximum number of widgets reached (12)');
    }

    const updatedWidgets = [...currentPreferences.widgets, newWidget];

    return await this.updateUserCustomization(userId, { widgets: updatedWidgets });
  }

  /**
   * Удаление виджета из профиля
   */
  async removeWidget(userId: string, widgetId: string): Promise<CustomizationPreferences> {
    this.logger.log(`Removing widget ${widgetId} for user ${userId}`);

    const currentPreferences = await this.getUserCustomization(userId);
    const updatedWidgets = currentPreferences.widgets.filter(w => w.id !== widgetId);

    if (updatedWidgets.length === currentPreferences.widgets.length) {
      throw new NotFoundException('Widget not found');
    }

    return await this.updateUserCustomization(userId, { widgets: updatedWidgets });
  }

  /**
   * Обновление позиции виджета
   */
  async updateWidgetPosition(
    userId: string,
    widgetId: string,
    position: { x: number; y: number },
  ): Promise<CustomizationPreferences> {
    this.logger.log(`Updating widget ${widgetId} position for user ${userId}`);

    const currentPreferences = await this.getUserCustomization(userId);
    const updatedWidgets = currentPreferences.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, position } : widget,
    );

    const widgetFound = updatedWidgets.some(w => w.id === widgetId);
    if (!widgetFound) {
      throw new NotFoundException('Widget not found');
    }

    return await this.updateUserCustomization(userId, { widgets: updatedWidgets });
  }

  /**
   * Получение доступных виджетов
   */
  getAvailableWidgets(): Record<string, Omit<WidgetConfiguration, 'id' | 'position' | 'order'>> {
    return this.availableWidgets;
  }

  /**
   * Сброс настроек к дефолтным
   */
  async resetToDefault(userId: string): Promise<CustomizationPreferences> {
    this.logger.log(`Resetting customization to default for user ${userId}`);

    const defaultPreferences = this.getDefaultCustomization();

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.customizationPreferences = defaultPreferences;
    await this.userRepository.save(user);

    await this.eventPublisher.publish('user.customization.reset', {
      userId,
      timestamp: new Date().toISOString(),
    });

    return defaultPreferences;
  }

  /**
   * Экспорт настроек пользователя
   */
  async exportUserCustomization(userId: string): Promise<string> {
    const preferences = await this.getUserCustomization(userId);
    return JSON.stringify(preferences, null, 2);
  }

  /**
   * Импорт настроек пользователя
   */
  async importUserCustomization(userId: string, customizationData: string): Promise<CustomizationPreferences> {
    this.logger.log(`Importing customization for user ${userId}`);

    try {
      const preferences = JSON.parse(customizationData) as CustomizationPreferences;
      this.validateCustomizationPreferences(preferences);

      return await this.updateUserCustomization(userId, preferences);
    } catch (error) {
      throw new BadRequestException('Invalid customization data format');
    }
  }

  /**
   * Получение дефолтных настроек кастомизации
   */
  private getDefaultCustomization(): CustomizationPreferences {
    return {
      theme: this.predefinedThemes.default,
      widgets: [
        {
          id: 'game_library_default',
          ...this.availableWidgets.game_library,
          position: { x: 0, y: 0 },
          order: 0,
        },
        {
          id: 'achievements_default',
          ...this.availableWidgets.achievements,
          position: { x: 320, y: 0 },
          order: 1,
        },
        {
          id: 'friends_default',
          ...this.availableWidgets.friends,
          position: { x: 0, y: 220 },
          order: 2,
        },
      ],
      layout: {
        template: 'classic',
        sections: {
          header: true,
          sidebar: true,
          mainContent: true,
          footer: true,
        },
      },
      privacy: {
        showOnlineStatus: true,
        showGameActivity: true,
        showAchievements: true,
        showFriends: true,
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        gameUpdates: true,
        friendRequests: true,
        achievements: true,
      },
      accessibility: {
        highContrast: false,
        largeText: false,
        reducedMotion: false,
        screenReader: false,
      },
    };
  }

  /**
   * Валидация настроек кастомизации
   */
  private validateCustomizationPreferences(preferences: CustomizationPreferences): void {
    // Валидация темы
    if (!preferences.theme.primaryColor || !preferences.theme.backgroundColor) {
      throw new BadRequestException('Theme must have primary color and background color');
    }

    // Валидация виджетов
    if (preferences.widgets.length > 12) {
      throw new BadRequestException('Maximum 12 widgets allowed');
    }

    // Валидация позиций виджетов (не должны перекрываться критично)
    const positions = preferences.widgets.map(w => w.position);
    // Простая проверка на дубликаты позиций
    const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
    if (uniquePositions.size !== positions.length) {
      this.logger.warn('Some widgets have overlapping positions');
    }

    // Валидация цветов (простая проверка hex формата)
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(preferences.theme.primaryColor) || !colorRegex.test(preferences.theme.backgroundColor)) {
      throw new BadRequestException('Invalid color format. Use hex colors like #ffffff');
    }
  }
}
