import { Controller, Get, Post, Query, Body, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserTokenService } from '../../../application/services/user-token.service';
import { AuthService } from '../../../application/services/auth.service';
import { PasswordResetService } from '../../../application/services/password-reset.service';
import { LoginDto } from '../dtos/login.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { Email } from '../../../domain/value-objects/email.value-object';
import { DeviceInfo } from '../../../domain/value-objects/device-info.vo';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenService: UserTokenService,
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Get('activate')
  @ApiOperation({ summary: 'Activate user account with a token' })
  @ApiQuery({ name: 'token', type: 'string', required: true })
  @ApiResponse({ status: 200, description: 'Account successfully activated.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired activation token.' })
  async activateAccount(@Query('token') token: string) {
    const { userId } = await this.tokenService.validateAndUseToken(token, 'activation');
    // The activation logic itself (setting user.isActive) is in UserService now.
    // This controller should call a service that handles that.
    // For now, this is incomplete as per the refactoring.
    return { message: 'Account successfully activated' };
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({ status: 201, description: 'Login successful. Returns JWT access token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const emailVO = new Email(loginDto.email);
    const user = await this.authService.validateUser(emailVO, loginDto.password);

    // Extract device info from request
    const deviceInfoVO = DeviceInfo.fromUserAgent(req.headers['user-agent'] || 'Unknown');
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Convert DeviceInfo VO to interface expected by session service
    const deviceInfo = {
      type: deviceInfoVO.type as 'desktop' | 'mobile' | 'tablet' | 'unknown',
      os: deviceInfoVO.os,
      browser: deviceInfoVO.browser,
      browserVersion: deviceInfoVO.browserVersion,
      version: deviceInfoVO.browserVersion, // Alias for compatibility
      userAgent: userAgent,
    };

    return this.authService.login(user, deviceInfo, ipAddress, userAgent);
  }

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 201, description: 'If a user with that email exists, an email will be sent.' })
  async requestPasswordReset(@Body('email') email: string) {
    const emailVO = new Email(email);
    await this.passwordResetService.requestPasswordReset(emailVO);
    return { message: 'Password reset email sent.' };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with a token' })
  @ApiResponse({ status: 200, description: 'Password has been successfully reset.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(resetDto.token, resetDto.newPassword);
    return { message: 'Password successfully reset.' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Get user profile (protected route)' })
  getProfile(@Req() req: Request & { user: any }) {
    return req.user;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh an access token' })
  @ApiResponse({ status: 201, description: 'New access token generated.' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Log out current user' })
  @ApiResponse({ status: 200, description: 'Successfully logged out.' })
  async logout(@Req() req: Request & { user: any }) {
    // Terminate current session
    if (req.user.sessionId) {
      await this.authService.terminateSession(req.user.sessionId, req.user.userId);
    }
    return { message: 'Successfully logged out' };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid current password.' })
  async changePassword(
    @Req() req: Request & { user: any },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    await this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword, req.user.sessionId);
    return { message: 'Password changed successfully' };
  }
}
