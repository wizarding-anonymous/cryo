import { Controller, Post, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MfaService } from '../../../application/services/mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { VerifyMfaDto } from '../dtos/verify-mfa.dto';

@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('enable')
  @ApiOperation({ summary: 'Initiate MFA setup for the logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the TOTP secret and a QR code data URL for setup.',
  })
  async enableMfa(@Req() req) {
    // req.user is populated by JwtAuthGuard
    const { userId, email } = req.user;
    return this.mfaService.enableMfa(userId, email);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a TOTP token to activate MFA' })
  @ApiResponse({ status: 200, description: 'MFA successfully activated.'})
  @ApiResponse({ status: 400, description: 'Invalid MFA token.'})
  async verifyAndActivateMfa(@Req() req, @Body() verifyMfaDto: VerifyMfaDto) {
    const { userId } = req.user;
    return this.mfaService.verifyAndActivateMfa(userId, verifyMfaDto.token);
  }
}
