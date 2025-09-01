import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';

export interface ProfileTheme {
  name: string;
  colorScheme: 'light' | 'dark' | 'auto' | 'custom';
  primaryColor: string;
  accentColor: string;
  backgroundImage?: string;
  customCSS?: string;
}

export interface ProfileWidget {
  id: string;
  type: 'achievements' | 'game_stats' | 'friends' | 'activity' | 'wishlist' | 'custom';
  title: string;
  position: number;
  isVisible: boolean;
  settings: WidgetSettings;
  data?: any;
}

export interface WidgetSettings {
  maxItems?: number;
  showIcons?: boolean;
  compactMode?: boolean;
  autoRefresh?: boolean;
  customStyle?: string;
}

export interface ProfileLayout {
  widgetOrder: string[];
  columnsCount: number;
  showSidebar: boolean;
  sidebarPosition: 'left' | 'right';
}

export interface DisplaySettings {
  showAchievements: boolean;
  showGameStats: boolean;
  showFriendsList: boolean;
  showRecentActivity: boolean;
  showWishlist: boolean;
  maxItemsPerWidget: number;
}

export interface AnimationSettings {
  enableAnimations: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  enableParticleEffects: boolean;
  enableSoundEffects: boolean;
}

export interface ProfileCustomization {
  userId: string;
  theme: ProfileTheme;
  widgets: ProfileWidget[];
  layout: ProfileLayout;
  display: DisplaySettings;
  animations: AnimationSettings;
  updatedAt: Date;
}

@Injectable()
export class CustomizationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async getProfileCustomization(userId: string): Promise<ProfileCustomization> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // В реальной реализации это должно быть в отдельной таблице profile_customizations
    // Для примера возвращаем дефолтную кастомизацию
    return {
      userId,
      theme: {
        name: 'default',
        colorScheme: 'auto',
        primaryColor: '#007bff',
        accentColor: '#28a745',
      },
      widgets: [
        {
          id: 'achievements',
          type: 'achievements',
          title: 'Recent Achievements',
          position: 1,
          isVisible: true,
          settings: { maxItems: 5, showIcons: true },
        },
        {
          id: 'game_stats',
          type: 'game_stats',
          title: 'Game Statistics',
          position: 2,
          isVisible: true,
          settings: { compactMode: false },
        },
      ],
      layout: {
        widgetOrder: ['achievements', 'game_stats'],
        columnsCount: 2,
        showSidebar: true,
        sidebarPosition: 'right',
      },
      display: {
        showAchievements: true,
        showGameStats: true,
        showFriendsList: true,
        showRecentActivity: true,
        showWishlist: true,
        maxItemsPerWidget: 10,
      },
      animations: {
        enableAnimations: true,
        animationSpeed: 'normal',
        enableParticleEffects: false,
        enableSoundEffects: false,
      },
      updatedAt: new Date(),
    };
  }

  async updateProfileTheme(userId: string, theme: ProfileTheme): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Валидация цветов
    if (!this.isValidColor(theme.primaryColor) || !this.isValidColor(theme.accentColor)) {
      throw new BadRequestException('Invalid color format');
    }

    // В реальной реализации обновляем таблицу profile_customizations
    // Для примера просто отправляем событие
    await this.eventPublisher.publish('ProfileThemeUpdated', {
      userId,
      theme,
      updatedAt: new Date(),
    });
  }

  async addProfileWidget(userId: string, widget: Omit<ProfileWidget, 'id'>): Promise<ProfileWidget> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newWidget: ProfileWidget = {
      ...widget,
      id: `widget_${Date.now()}`,
    };

    // В реальной реализации сохраняем в БД
    await this.eventPublisher.publish('ProfileWidgetAdded', {
      userId,
      widget: newWidget,
      addedAt: new Date(),
    });

    return newWidget;
  }

  async removeProfileWidget(userId: string, widgetId: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.eventPublisher.publish('ProfileWidgetRemoved', {
      userId,
      widgetId,
      removedAt: new Date(),
    });
  }

  async updateProfileWidget(userId: string, widgetId: string, updates: Partial<ProfileWidget>): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.eventPublisher.publish('ProfileWidgetUpdated', {
      userId,
      widgetId,
      updates,
      updatedAt: new Date(),
    });
  }

  async reorderProfileWidgets(userId: string, widgetOrder: string[]): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.eventPublisher.publish('ProfileWidgetsReordered', {
      userId,
      widgetOrder,
      updatedAt: new Date(),
    });
  }

  async updateDisplaySettings(userId: string, settings: DisplaySettings): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Валидация настроек
    if (settings.maxItemsPerWidget < 1 || settings.maxItemsPerWidget > 50) {
      throw new BadRequestException('maxItemsPerWidget must be between 1 and 50');
    }

    await this.eventPublisher.publish('ProfileDisplaySettingsUpdated', {
      userId,
      settings,
      updatedAt: new Date(),
    });
  }

  async updateAnimationSettings(userId: string, settings: AnimationSettings): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.eventPublisher.publish('ProfileAnimationSettingsUpdated', {
      userId,
      settings,
      updatedAt: new Date(),
    });
  }

  async exportCustomizationSettings(userId: string): Promise<ProfileCustomization> {
    return this.getProfileCustomization(userId);
  }

  async importCustomizationSettings(userId: string, customization: Partial<ProfileCustomization>): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Валидация импортируемых данных
    if (customization.theme && customization.theme.primaryColor && !this.isValidColor(customization.theme.primaryColor)) {
      throw new BadRequestException('Invalid primary color in imported settings');
    }

    await this.eventPublisher.publish('ProfileCustomizationImported', {
      userId,
      customization,
      importedAt: new Date(),
    });
  }

  private isValidColor(color: string): boolean {
    // Простая валидация HEX цветов
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }
}
