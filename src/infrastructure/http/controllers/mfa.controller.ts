import { 
  Controller, 
  Post, 
  Get, 
  Delete, 
  Body, 
  UseGuards, 
  Req, 
  HttpCode, 
  Param 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MfaService } from '../../../application/services/mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { VerifyMfaDto } from '../dtos/verify-mfa.dto';
import { EnableSmsDto, VerifySmsDto, VerifyMfaTokenDto } from '../dtos/mfa.dto';

@ApiTags('Multi-Factor Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get MFA status and enabled methods' })
  @ApiResponse({ status: 200, description: 'MFA status retrieved successfully' })
  async getMfaStatus(@Req() req) {
    return this.mfaService.getMfaStatus(req.user.userId);
  }

  @Post('totp/enable')
  @ApiOperation({ summary: 'Enable TOTP MFA (Google Authenticator)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the TOTP secret, QR code and backup codes for setup.',
  })
  async enableTotpMfa(@Req() req) {
    const { userId, email } = req.user;
    return this.mfaService.enableTotpMfa(userId, email);
  }

  @Post('totp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify TOTP token to activate MFA' })
  @ApiResponse({ status: 200, description: 'TOTP MFA successfully activated.'})
  @ApiResponse({ status: 400, description: 'Invalid MFA token.'})
  async verifyAndActivateTotpMfa(@Req() req, @Body() verifyMfaDto: VerifyMfaDto) {
    const { userId } = req.user;
    return this.mfaService.verifyAndActivateTotpMfa(userId, verifyMfaDto.token);
  }

  @Post('sms/enable')
  @ApiOperation({ summary: 'Enable SMS MFA' })
  @ApiResponse({ status: 200, description: 'SMS verification code sent' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  async enableSmsMfa(@Req() req, @Body() smsData: EnableSmsDto) {
    return this.mfaService.enableSmsMfa(req.user.userId, smsData.phoneNumber);
  }

  @Post('sms/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify SMS code to activate SMS MFA' })
  @ApiResponse({ status: 200, description: 'SMS MFA successfully activated' })
  @ApiResponse({ status: 400, description: 'Invalid SMS code' })
  async verifySmsMfa(@Req() req, @Body() smsData: VerifySmsDto) {
    return this.mfaService.verifySmsSetup(req.user.userId, smsData.code);
  }

  @Post('verify-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify MFA token during login' })
  @ApiResponse({ status: 200, description: 'Token verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  async verifyMfaToken(
    @Req() req, 
    @Body() tokenData: VerifyMfaTokenDto
  ) {
    const isValid = await this.mfaService.verifyMfaToken(
      req.user.userId, 
      tokenData.token, 
      tokenData.method
    );
    return { valid: isValid };
  }

  @Post('backup-codes/regenerate')
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiResponse({ status: 200, description: 'New backup codes generated' })
  async regenerateBackupCodes(@Req() req) {
    const backupCodes = await this.mfaService.generateNewBackupCodes(req.user.userId);
    return { backupCodes };
  }

  @Delete(':method')
  @ApiOperation({ summary: 'Disable specific MFA method' })
  @ApiResponse({ status: 200, description: 'MFA method disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid MFA method' })
  async disableMfaMethod(@Req() req, @Param('method') method: 'totp' | 'sms') {
    await this.mfaService.disableMfaMethod(req.user.userId, method);
    return { message: `${method.toUpperCase()} MFA disabled successfully` };
  }

  // Deprecated - для обратной совместимости
  @Post('enable')
  @ApiOperation({ 
    summary: 'Initiate MFA setup (deprecated - use /totp/enable)', 
    deprecated: true 
  })
  async enableMfa(@Req() req) {
    const { userId, email } = req.user;
    return this.mfaService.enableTotpMfa(userId, email);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Verify TOTP token (deprecated - use /totp/verify)', 
    deprecated: true 
  })
  async verifyAndActivateMfa(@Req() req, @Body() verifyMfaDto: VerifyMfaDto) {
    const { userId } = req.user;
    return this.mfaService.verifyAndActivateTotpMfa(userId, verifyMfaDto.token);
  }
}
