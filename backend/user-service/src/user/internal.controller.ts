import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  HttpStatus,
  HttpCode,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserServiceError } from '../common/errors';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { ProfileService } from '../profile/profile.service';
import { InternalServiceGuard, RateLimit, RateLimitType } from '../common/guards';
import { CreateUserDto } from './dto/create-user.dto';
import { InternalUserResponseDto } from './dto/internal-user-response.dto';
import {
  InternalProfileResponseDto,
  InternalBatchProfilesResponseDto,
} from './dto/internal-profile-response.dto';
import {
  InternalBillingInfoDto,
  UpdateBillingInfoDto,
} from './dto/internal-billing-info.dto';
import { InternalBatchProfilesRequestDto } from './dto/internal-batch-profiles.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('Internal Microservice APIs')
@ApiSecurity('internal-api-key')
@ApiSecurity('internal-bearer')
@Controller('internal')
@UseGuards(InternalServiceGuard)
@RateLimit({ type: RateLimitType.INTERNAL })
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly userService: UserService,
    private readonly profileService: ProfileService,
  ) {}

  // ==========================================
  // Auth Service Endpoints
  // ==========================================

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user (Auth Service)',
    description: 'Creates a new user with pre-hashed password for Auth Service',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: InternalUserResponseDto,
  })
  async createUserForAuth(
    @Body() createUserDto: CreateUserDto,
  ): Promise<InternalUserResponseDto> {
    this.logger.log(
      `Auth Service: Creating user with email ${createUserDto.email}`,
    );
    const user = await this.userService.create(createUserDto);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as InternalUserResponseDto;
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Get user by ID (Auth Service)',
    description: 'Retrieves user information by ID for Auth Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: InternalUserResponseDto,
  })
  async getUserForAuth(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<InternalUserResponseDto> {
    const correlationId = (request as any).correlationId;
    this.logger.log(`Auth Service: Getting user ${id}`);
    const user = await this.userService.findById(id);

    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as InternalUserResponseDto;
  }

  @Get('users/email/:email')
  @ApiOperation({
    summary: 'Get user by email (Auth Service)',
    description: 'Retrieves user information by email for Auth Service',
  })
  @ApiParam({
    name: 'email',
    description: 'User email address',
    example: 'user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: InternalUserResponseDto,
  })
  async getUserByEmailForAuth(
    @Param('email') email: string,
    @Req() request: Request,
  ): Promise<InternalUserResponseDto> {
    const correlationId = (request as any).correlationId;
    this.logger.log(`Auth Service: Getting user by email ${email}`);
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw UserServiceError.userNotFound(email, correlationId);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as InternalUserResponseDto;
  }

  @Patch('users/:id/last-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update last login (Auth Service)',
    description: 'Updates user last login timestamp for Auth Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Last login updated successfully',
  })
  async updateLastLoginForAuth(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Auth Service: Updating last login for user ${id}`);
    await this.userService.updateLastLogin(id);
    return { message: 'Last login updated successfully' };
  }

  @Get('users/:id/exists')
  @ApiOperation({
    summary: 'Check if user exists (Auth Service)',
    description: 'Checks if user exists by ID for Auth Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User existence check result',
  })
  async checkUserExistsForAuth(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Auth Service: Checking if user exists ${id}`);
    const user = await this.userService.findById(id);
    return { exists: !!user };
  }

  // ==========================================
  // Game Catalog Service Endpoints
  // ==========================================

  @Get('users/:id/profile')
  @ApiOperation({
    summary: 'Get user profile (Game Catalog Service)',
    description: 'Retrieves user profile information for Game Catalog Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'includePreferences',
    description: 'Include user preferences in response',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'includePrivacySettings',
    description: 'Include privacy settings in response',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: InternalProfileResponseDto,
  })
  async getUserProfileForGameCatalog(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Query('includePreferences') includePreferences?: boolean,
    @Query('includePrivacySettings') includePrivacySettings?: boolean,
  ): Promise<InternalProfileResponseDto> {
    const correlationId = (request as any).correlationId;
    this.logger.log(`Game Catalog Service: Getting profile for user ${id}`);

    const user = await this.userService.findById(id);
    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    const profile: InternalProfileResponseDto = {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferences: includePreferences ? user.preferences : null,
      privacySettings: includePrivacySettings ? user.privacySettings : null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };

    return profile;
  }

  @Post('users/batch/profiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get multiple user profiles (Game Catalog Service)',
    description: 'Retrieves multiple user profiles for Game Catalog Service',
  })
  @ApiResponse({
    status: 200,
    description: 'User profiles retrieved successfully',
    type: InternalBatchProfilesResponseDto,
  })
  async getBatchProfilesForGameCatalog(
    @Body() requestDto: InternalBatchProfilesRequestDto,
  ): Promise<InternalBatchProfilesResponseDto> {
    const {
      userIds,
      includePreferences = true,
      includePrivacySettings = false,
      chunkSize = 50,
    } = requestDto;

    this.logger.log(
      `Game Catalog Service: Getting batch profiles for ${userIds.length} users`,
    );

    const usersMap = await this.userService.findUsersBatch(userIds, {
      chunkSize,
    });
    const users = Array.from(usersMap.values());

    const profiles: InternalProfileResponseDto[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferences: includePreferences ? user.preferences : null,
      privacySettings: includePrivacySettings ? user.privacySettings : null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    }));

    return {
      profiles,
      stats: {
        requested: userIds.length,
        found: profiles.length,
        missing: userIds.length - profiles.length,
      },
    };
  }

  // ==========================================
  // Payment Service Endpoints
  // ==========================================

  @Get('users/:id/billing-info')
  @ApiOperation({
    summary: 'Get user billing info (Payment Service)',
    description: 'Retrieves user billing information for Payment Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User billing info retrieved successfully',
    type: InternalBillingInfoDto,
  })
  async getBillingInfoForPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<InternalBillingInfoDto> {
    const correlationId = (request as any).correlationId;
    this.logger.log(`Payment Service: Getting billing info for user ${id}`);

    const user = await this.userService.findById(id);
    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      language: user.preferences?.language || null,
      timezone: user.preferences?.timezone || null,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  @Patch('users/:id/billing-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user billing info (Payment Service)',
    description: 'Updates user billing information for Payment Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing info updated successfully',
    type: InternalBillingInfoDto,
  })
  async updateBillingInfoForPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateBillingInfoDto,
    @Req() request: Request,
  ): Promise<InternalBillingInfoDto> {
    const correlationId = (request as any).correlationId;
    this.logger.log(`Payment Service: Updating billing info for user ${id}`);

    const user = await this.userService.findById(id);
    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    // Update basic user info if provided
    const updateData: any = {};
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.email) updateData.email = updateDto.email;

    // Update preferences if language or timezone provided
    if (updateDto.language || updateDto.timezone) {
      const currentPreferences = user.preferences || {
        language: 'en',
        timezone: 'UTC',
        theme: 'light' as const,
        notifications: { email: true, push: true, sms: false },
        gameSettings: {
          autoDownload: false,
          cloudSave: true,
          achievementNotifications: true,
        },
      };

      updateData.preferences = {
        ...currentPreferences,
        ...(updateDto.language && { language: updateDto.language }),
        ...(updateDto.timezone && { timezone: updateDto.timezone }),
      };
    }

    if (Object.keys(updateData).length > 0) {
      await this.userService.update(id, updateData);
    }

    // Return updated billing info
    const updatedUser = await this.userService.findById(id);
    return {
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      language: updatedUser.preferences?.language || null,
      timezone: updatedUser.preferences?.timezone || null,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
    };
  }

  // ==========================================
  // Library Service Endpoints
  // ==========================================

  @Get('users/:id/preferences')
  @ApiOperation({
    summary: 'Get user preferences (Library Service)',
    description: 'Retrieves user preferences for Library Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
  })
  async getPreferencesForLibrary(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Library Service: Getting preferences for user ${id}`);
    return this.profileService.getPreferences(id);
  }

  @Patch('users/:id/preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user preferences (Library Service)',
    description: 'Updates user preferences for Library Service',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User preferences updated successfully',
  })
  async updatePreferencesForLibrary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    this.logger.log(`Library Service: Updating preferences for user ${id}`);
    return this.profileService.updatePreferences(id, updatePreferencesDto);
  }
}
