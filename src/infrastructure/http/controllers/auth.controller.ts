import { Controller, Get, Post, Query, Body, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UserTokenService } from '../../../application/services/user-token.service';
import { AuthService } from '../../../application/services/auth.service';
import { PasswordResetService } from '../../../application/services/password-reset.service';
import { UserActivationService } from '../../../application/services/user-activation.service';
import { LoginDto } from '../dtos/login.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { ResendActivationDto } from '../dtos/activation.dto';
import { Email } from '../../../domain/value-objects/email.value-object';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
      private readonly tokenService: UserTokenService,
      private readonly authService: AuthService,
      private readonly passwordResetService: PasswordResetService,
      private readonly userActivationService: UserActivationService,
    ) {}

  @Get('activate')
  @ApiOperation({ summary: 'Activate user account with a token' })
  @ApiQuery({ name: 'token', type: 'string', required: true })
  @ApiResponse({ status: 200, description: 'Account successfully activated.'})
  @ApiResponse({ status: 400, description: 'Invalid or expired activation token.'})
  async activateAccount(@Query('token') token: string) {
    await this.userActivationService.activateUser(token);
    return { message: 'Account successfully activated' };
  }

  @Post('resend-activation')
  @ApiOperation({ summary: 'Resend activation email' })
  @ApiResponse({ status: 200, description: 'Activation email sent if account exists and is not verified' })
  @ApiResponse({ status: 400, description: 'Email already verified or sent recently' })
  async resendActivationEmail(@Body() activationDto: ResendActivationDto) {
    const result = await this.userActivationService.resendActivationEmail(activationDto.email);
    return result;
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({ status: 201, description: 'Login successful. Returns JWT access token.'})
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.'})
  async login(@Body() loginDto: LoginDto) {
    const emailVO = new Email(loginDto.email);
    const user = await this.authService.validateUser(emailVO, loginDto.password);
    return this.authService.login(user);
  }

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 201, description: 'If a user with that email exists, an email will be sent.'})
  async requestPasswordReset(@Body('email') email: string) {
    const emailVO = new Email(email);
    await this.passwordResetService.requestPasswordReset(emailVO);
    return { message: 'Password reset email sent.' };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with a token' })
  @ApiResponse({ status: 200, description: 'Password has been successfully reset.'})
  @ApiResponse({ status: 400, description: 'Invalid or expired token.'})
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Refresh an access token' })
  @ApiResponse({ status: 201, description: 'New access token generated.'})
  async refreshToken(@Req() req: Request & { user: any }) {
    return this.authService.refreshToken(req.user.userId);
  }
}
