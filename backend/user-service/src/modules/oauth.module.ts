import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { MockOAuthService } from '../application/services/mock-oauth.service';
import { OAuthController } from '../infrastructure/http/controllers/oauth.controller';

@Module({
  imports: [AuthModule],
  providers: [MockOAuthService],
  controllers: [OAuthController],
})
export class OAuthModule {}
