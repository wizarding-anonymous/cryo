import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomizationService, CustomizationPreferences } from '../../../application/services/customization.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Profile Customization')
@Controller('users/customization')
export class CustomizationController {
  constructor(private readonly customizationService: CustomizationService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user customization preferences' })
  @ApiResponse({ status: 200, description: 'Customization preferences retrieved successfully' })
  async getMyCustomization(@Req() req: Request & { user: any }) {
    return this.customizationService.getUserCustomization(req.user.userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user customization preferences' })
  @ApiResponse({ status: 200, description: 'Customization preferences updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid customization data' })
  async updateMyCustomization(
    @Req() req: Request & { user: any },
    @Body() preferences: Partial<CustomizationPreferences>,
  ) {
    return this.customizationService.updateUserCustomization(req.user.userId, preferences);
  }

  @Get('themes')
  @ApiOperation({ summary: 'Get available predefined themes' })
  @ApiResponse({ status: 200, description: 'Available themes retrieved successfully' })
  getAvailableThemes() {
    return this.customizationService.getAvailableThemes();
  }

  @Post('me/theme/:themeName')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Apply predefined theme to current user profile' })
  @ApiResponse({ status: 200, description: 'Theme applied successfully' })
  @ApiResponse({ status: 400, description: 'Theme not found' })
  async applyTheme(@Req() req: Request & { user: any }, @Param('themeName') themeName: string) {
    return this.customizationService.applyPredefinedTheme(req.user.userId, themeName);
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Get available widget types' })
  @ApiResponse({ status: 200, description: 'Available widgets retrieved successfully' })
  getAvailableWidgets() {
    return this.customizationService.getAvailableWidgets();
  }

  @Post('me/widgets')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add widget to current user profile' })
  @ApiResponse({ status: 201, description: 'Widget added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid widget type or maximum widgets reached' })
  async addWidget(
    @Req() req: Request & { user: any },
    @Body() body: { widgetType: string; position: { x: number; y: number } },
  ) {
    return this.customizationService.addWidget(req.user.userId, body.widgetType, body.position);
  }

  @Delete('me/widgets/:widgetId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove widget from current user profile' })
  @ApiResponse({ status: 200, description: 'Widget removed successfully' })
  @ApiResponse({ status: 404, description: 'Widget not found' })
  async removeWidget(@Req() req: Request & { user: any }, @Param('widgetId') widgetId: string) {
    return this.customizationService.removeWidget(req.user.userId, widgetId);
  }

  @Put('me/widgets/:widgetId/position')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update widget position' })
  @ApiResponse({ status: 200, description: 'Widget position updated successfully' })
  @ApiResponse({ status: 404, description: 'Widget not found' })
  async updateWidgetPosition(
    @Req() req: Request & { user: any },
    @Param('widgetId') widgetId: string,
    @Body() body: { position: { x: number; y: number } },
  ) {
    return this.customizationService.updateWidgetPosition(req.user.userId, widgetId, body.position);
  }

  @Post('me/reset')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reset customization to default settings' })
  @ApiResponse({ status: 200, description: 'Customization reset to default successfully' })
  async resetToDefault(@Req() req: Request & { user: any }) {
    return this.customizationService.resetToDefault(req.user.userId);
  }

  @Get('me/export')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export current user customization settings' })
  @ApiResponse({ status: 200, description: 'Customization settings exported successfully' })
  async exportCustomization(@Req() req: Request & { user: any }) {
    const customizationData = await this.customizationService.exportUserCustomization(req.user.userId);
    return {
      data: customizationData,
      filename: `customization_${req.user.userId}_${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  @Post('me/import')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Import customization settings' })
  @ApiResponse({ status: 200, description: 'Customization settings imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid customization data format' })
  async importCustomization(@Req() req: Request & { user: any }, @Body() body: { customizationData: string }) {
    return this.customizationService.importUserCustomization(req.user.userId, body.customizationData);
  }
}
