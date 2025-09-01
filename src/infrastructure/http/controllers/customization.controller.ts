import { 
  Controller, 
  Get, 
  Put, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomizationService } from '../../../application/services/customization.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { 
  ProfileThemeDto, 
  CreateProfileWidgetDto, 
  UpdateProfileWidgetDto,
  ReorderWidgetsDto,
  DisplaySettingsDto, 
  AnimationSettingsDto 
} from '../dtos/customization.dto';

@ApiTags('Profile Customization')
@Controller('customization')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomizationController {
  constructor(private readonly customizationService: CustomizationService) {}

  @Get()
  @ApiOperation({ summary: 'Get user profile customization settings' })
  @ApiResponse({ status: 200, description: 'Customization settings retrieved successfully' })
  async getCustomization(@Request() req: any) {
    return this.customizationService.getProfileCustomization(req.user.userId);
  }

  @Put('theme')
  @ApiOperation({ summary: 'Update profile theme' })
  @ApiResponse({ status: 200, description: 'Theme updated successfully' })
  async updateTheme(@Request() req: any, @Body() theme: ProfileThemeDto) {
    await this.customizationService.updateProfileTheme(req.user.userId, theme);
    return { message: 'Theme updated successfully' };
  }

  @Post('widgets')
  @ApiOperation({ summary: 'Add profile widget' })
  @ApiResponse({ status: 201, description: 'Widget added successfully' })
  async addWidget(@Request() req: any, @Body() widget: CreateProfileWidgetDto) {
    return this.customizationService.addProfileWidget(req.user.userId, widget);
  }

  @Put('widgets/:widgetId')
  @ApiOperation({ summary: 'Update profile widget' })
  @ApiResponse({ status: 200, description: 'Widget updated successfully' })
  async updateWidget(
    @Request() req: any,
    @Param('widgetId') widgetId: string,
    @Body() updates: UpdateProfileWidgetDto
  ) {
    await this.customizationService.updateProfileWidget(req.user.userId, widgetId, updates);
    return { message: 'Widget updated successfully' };
  }

  @Delete('widgets/:widgetId')
  @ApiOperation({ summary: 'Remove profile widget' })
  @ApiResponse({ status: 200, description: 'Widget removed successfully' })
  async removeWidget(@Request() req: any, @Param('widgetId') widgetId: string) {
    await this.customizationService.removeProfileWidget(req.user.userId, widgetId);
    return { message: 'Widget removed successfully' };
  }

  @Put('widgets/order')
  @ApiOperation({ summary: 'Reorder profile widgets' })
  @ApiResponse({ status: 200, description: 'Widgets reordered successfully' })
  async reorderWidgets(@Request() req: any, @Body() orderData: ReorderWidgetsDto) {
    await this.customizationService.reorderProfileWidgets(req.user.userId, orderData.widgetOrder);
    return { message: 'Widgets reordered successfully' };
  }

  @Put('display')
  @ApiOperation({ summary: 'Update display settings' })
  @ApiResponse({ status: 200, description: 'Display settings updated successfully' })
  async updateDisplaySettings(@Request() req: any, @Body() settings: DisplaySettingsDto) {
    await this.customizationService.updateDisplaySettings(req.user.userId, settings);
    return { message: 'Display settings updated successfully' };
  }

  @Put('animations')
  @ApiOperation({ summary: 'Update animation settings' })
  @ApiResponse({ status: 200, description: 'Animation settings updated successfully' })
  async updateAnimationSettings(@Request() req: any, @Body() settings: AnimationSettingsDto) {
    await this.customizationService.updateAnimationSettings(req.user.userId, settings);
    return { message: 'Animation settings updated successfully' };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export customization settings' })
  @ApiResponse({ status: 200, description: 'Settings exported successfully' })
  async exportSettings(@Request() req: any) {
    return this.customizationService.exportCustomizationSettings(req.user.userId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import customization settings' })
  @ApiResponse({ status: 200, description: 'Settings imported successfully' })
  async importSettings(@Request() req: any, @Body() customization: any) {
    await this.customizationService.importCustomizationSettings(req.user.userId, customization);
    return { message: 'Settings imported successfully' };
  }
}