import { Controller, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProfileService } from '../../../application/services/profile.service';

@ApiTags('User Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Put('settings/privacy')
  @ApiOperation({ summary: "Update the current user's privacy settings" })
  async updatePrivacySettings(@Req() req, @Body() settings: object) {
    await this.profileService.updatePrivacySettings(req.user.userId, settings);
    return { message: 'Privacy settings updated successfully.' };
  }

  @Put('settings/notifications')
  @ApiOperation({ summary: "Update the current user's notification settings" })
  async updateNotificationSettings(@Req() req, @Body() settings: object) {
    await this.profileService.updateNotificationSettings(req.user.userId, settings);
    return { message: 'Notification settings updated successfully.' };
  }
}
