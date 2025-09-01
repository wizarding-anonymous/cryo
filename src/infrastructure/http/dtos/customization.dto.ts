import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ProfileThemeDto {
  @ApiProperty({ description: 'Theme name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Color scheme', enum: ['light', 'dark', 'auto', 'custom'] })
  @IsEnum(['light', 'dark', 'auto', 'custom'])
  colorScheme: 'light' | 'dark' | 'auto' | 'custom';

  @ApiProperty({ description: 'Primary color (hex)' })
  @IsString()
  primaryColor: string;

  @ApiProperty({ description: 'Accent color (hex)' })
  @IsString()
  accentColor: string;

  @ApiProperty({ description: 'Background image URL', required: false })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiProperty({ description: 'Custom CSS', required: false })
  @IsOptional()
  @IsString()
  customCSS?: string;
}

export class WidgetSettingsDto {
  @ApiProperty({ description: 'Maximum items to display', required: false })
  @IsOptional()
  @IsNumber()
  maxItems?: number;

  @ApiProperty({ description: 'Show icons', required: false })
  @IsOptional()
  @IsBoolean()
  showIcons?: boolean;

  @ApiProperty({ description: 'Compact mode', required: false })
  @IsOptional()
  @IsBoolean()
  compactMode?: boolean;

  @ApiProperty({ description: 'Auto refresh', required: false })
  @IsOptional()
  @IsBoolean()
  autoRefresh?: boolean;

  @ApiProperty({ description: 'Custom style', required: false })
  @IsOptional()
  @IsString()
  customStyle?: string;
}

export class CreateProfileWidgetDto {
  @ApiProperty({ description: 'Widget type', enum: ['achievements', 'game_stats', 'friends', 'activity', 'wishlist', 'custom'] })
  @IsEnum(['achievements', 'game_stats', 'friends', 'activity', 'wishlist', 'custom'])
  type: 'achievements' | 'game_stats' | 'friends' | 'activity' | 'wishlist' | 'custom';

  @ApiProperty({ description: 'Widget title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Widget position' })
  @IsNumber()
  position: number;

  @ApiProperty({ description: 'Widget visibility' })
  @IsBoolean()
  isVisible: boolean;

  @ApiProperty({ description: 'Widget settings' })
  @ValidateNested()
  @Type(() => WidgetSettingsDto)
  settings: WidgetSettingsDto;
}

export class UpdateProfileWidgetDto {
  @ApiProperty({ description: 'Widget title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Widget position', required: false })
  @IsOptional()
  @IsNumber()
  position?: number;

  @ApiProperty({ description: 'Widget visibility', required: false })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiProperty({ description: 'Widget settings', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WidgetSettingsDto)
  settings?: WidgetSettingsDto;
}

export class ReorderWidgetsDto {
  @ApiProperty({ description: 'Array of widget IDs in new order' })
  @IsArray()
  @IsString({ each: true })
  widgetOrder: string[];
}

export class DisplaySettingsDto {
  @ApiProperty({ description: 'Show achievements' })
  @IsBoolean()
  showAchievements: boolean;

  @ApiProperty({ description: 'Show game statistics' })
  @IsBoolean()
  showGameStats: boolean;

  @ApiProperty({ description: 'Show friends list' })
  @IsBoolean()
  showFriendsList: boolean;

  @ApiProperty({ description: 'Show recent activity' })
  @IsBoolean()
  showRecentActivity: boolean;

  @ApiProperty({ description: 'Show wishlist' })
  @IsBoolean()
  showWishlist: boolean;

  @ApiProperty({ description: 'Maximum items per widget' })
  @IsNumber()
  maxItemsPerWidget: number;
}

export class AnimationSettingsDto {
  @ApiProperty({ description: 'Enable animations' })
  @IsBoolean()
  enableAnimations: boolean;

  @ApiProperty({ description: 'Animation speed', enum: ['slow', 'normal', 'fast'] })
  @IsEnum(['slow', 'normal', 'fast'])
  animationSpeed: 'slow' | 'normal' | 'fast';

  @ApiProperty({ description: 'Enable particle effects' })
  @IsBoolean()
  enableParticleEffects: boolean;

  @ApiProperty({ description: 'Enable sound effects' })
  @IsBoolean()
  enableSoundEffects: boolean;
}