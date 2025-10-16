import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { UpdatePreferencesDto } from '../user/dto/update-preferences.dto';
import { UpdatePrivacySettingsDto } from '../user/dto/update-privacy-settings.dto';
import {
  UploadAvatarDto,
  AvatarResponseDto,
} from '../user/dto/upload-avatar.dto';
import { multerConfig } from '../common/config/multer.config';
import { RateLimit, RateLimitType } from '../common/guards';

@ApiTags('Profile Management')
@Controller('profiles')
@RateLimit({ type: RateLimitType.PROFILE })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Retrieve user profile information by user ID',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User profile not found',
  })
  async getProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update user profile information',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid profile data',
  })
  async updateProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, updateProfileDto);
  }

  @Delete(':userId')
  @ApiOperation({
    summary: 'Delete user profile',
    description: 'Soft delete user profile and associated data',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Profile deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async deleteProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    await this.profileService.deleteProfile(userId);
  }

  @Post(':userId/avatar')
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  @RateLimit({ 
    type: RateLimitType.UPLOAD, 
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3, // Only 3 avatar uploads per minute
    message: 'Too many avatar uploads, please try again later'
  })
  @ApiOperation({
    summary: 'Upload user avatar',
    description:
      'Upload avatar image for user (max 5MB, formats: jpg, jpeg, png, gif)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Avatar image file',
    type: UploadAvatarDto,
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Avatar uploaded successfully',
    type: AvatarResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or file too large',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async uploadAvatar(
    @Param('userId', ParseUUIDPipe) userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.uploadAvatar(userId, file);
  }

  @Delete(':userId/avatar')
  @ApiOperation({
    summary: 'Delete user avatar',
    description: 'Remove user avatar image',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avatar deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User has no avatar to delete',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async deleteAvatar(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.deleteAvatar(userId);
  }

  @Get(':userId/preferences')
  @ApiOperation({
    summary: 'Get user preferences',
    description:
      'Retrieve user preferences (language, theme, notifications, etc.)',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User preferences retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getPreferences(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.getPreferences(userId);
  }

  @Patch(':userId/preferences')
  @ApiOperation({
    summary: 'Update user preferences',
    description:
      'Update user preferences (language, theme, notifications, game settings)',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid preferences data',
  })
  async updatePreferences(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.profileService.updatePreferences(userId, updatePreferencesDto);
  }

  @Get(':userId/privacy-settings')
  @ApiOperation({
    summary: 'Get user privacy settings',
    description:
      'Retrieve user privacy settings (profile visibility, online status, etc.)',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Privacy settings retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async getPrivacySettings(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.getPrivacySettings(userId);
  }

  @Patch(':userId/privacy-settings')
  @ApiOperation({
    summary: 'Update user privacy settings',
    description:
      'Update user privacy settings (profile visibility, online status, game activity)',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Privacy settings updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid privacy settings data',
  })
  async updatePrivacySettings(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updatePrivacySettingsDto: UpdatePrivacySettingsDto,
  ) {
    return this.profileService.updatePrivacySettings(
      userId,
      updatePrivacySettingsDto,
    );
  }
}
