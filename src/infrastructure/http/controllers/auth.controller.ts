import { Controller, Get, Post, Query, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UserActivationService } from '../../../application/services/user-activation.service';
import { AuthService } from '../../../application/services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { Email } from '../../../domain/value-objects/email.value-object';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
      private readonly activationService: UserActivationService,
      private readonly authService: AuthService,
    ) {}

  @Get('activate')
  @ApiOperation({ summary: 'Activate user account with a token' })
  @ApiQuery({ name: 'token', type: 'string', required: true })
  @ApiResponse({ status: 200, description: 'Account successfully activated.'})
  @ApiResponse({ status: 400, description: 'Invalid or expired activation token.'})
  async activateAccount(@Query('token') token: string) {
    await this.activationService.activateUser(token);
    return { message: 'Account successfully activated' };
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in a user' })
  @ApiResponse({ status: 201, description: 'Login successful. Returns user object (without password).'})
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.'})
  async login(@Body() loginDto: LoginDto) {
    try {
        const emailVO = new Email(loginDto.email);
        const user = await this.authService.authenticate(emailVO, loginDto.password);

        // In a real app, we would return a JWT here.
        // For now, returning a sanitized user object.
        const { passwordHash, ...result } = user;
        return result;

    } catch (error) {
        if (error instanceof UnauthorizedException) {
            throw new UnauthorizedException(error.message);
        }
        throw error;
    }
  }
}
