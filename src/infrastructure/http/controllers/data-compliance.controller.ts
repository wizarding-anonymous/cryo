import { Controller, Get, Post, Delete, Req, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('User Data Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/data')
export class DataComplianceController {
  private readonly logger = new Logger(DataComplianceController.name);

  @Get('me/export')
  @ApiOperation({ summary: 'Request an export of user personal data (GDPR/152-ФЗ)' })
  async exportPersonalData(@Req() req) {
    const userId = req.user.userId;
    this.logger.log(`📤 User ${userId} requested a data export.`);
    return {
      message: 'Data export request has been accepted.',
      requestId: `export_${Date.now()}`
    };
  }

  @Delete('me')
  @ApiOperation({ summary: 'Request deletion of all user data (Right to be forgotten)' })
  async deleteAllUserData(@Req() req, @Body('confirmPhrase') confirmPhrase: string) {
    const userId = req.user.userId;
    this.logger.log(`🗑️ User ${userId} requested account deletion with confirmation: "${confirmPhrase}"`);
    return {
      message: 'Account deletion request has been accepted and will be processed.',
      requestId: `deletion_${Date.now()}`
    };
  }

  @Get('me/consent')
  @ApiOperation({ summary: 'Get the current status of user consents' })
  async getConsentStatus(@Req() req) {
    this.logger.log(`📋 Checking consent status for user ${req.user.userId}`);
    return {
      dataProcessingConsent: true,
      marketingConsent: false,
      analyticsConsent: true,
      lastUpdated: new Date(),
    };
  }
}
