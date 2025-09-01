import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MockOAuthService } from '../../../application/services/mock-oauth.service';
import { AuthService } from '../../../application/services/auth.service';

@ApiTags('Authentication')
@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly mockOAuthService: MockOAuthService,
    private readonly authService: AuthService,
  ) {}

  @Get('vk')
  @ApiOperation({ summary: 'Initiate VK OAuth (Mock)' })
  initiateVKAuth() {
    const mockAuthUrl = 'https://oauth.vk.com/authorize?mock=true';
    this.logger.log(`🔗 Redirecting to VK OAuth (mock): ${mockAuthUrl}`);
    return {
      authUrl: mockAuthUrl,
      message: 'In a real app, a redirect would occur.',
      mockCode: 'mock_vk_code_12345',
    };
  }

  @Post('vk/callback')
  @ApiOperation({ summary: 'Handle VK OAuth callback (Mock)' })
  async handleVKCallback(@Body('code') code: string) {
    const userData = await this.mockOAuthService.authenticate('vk', code);
    const tokens = await this.authService.loginOrRegisterOAuth(userData);
    return {
      message: 'Successfully authenticated with VK (mock).',
      tokens,
    };
  }
}
