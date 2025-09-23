import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserServiceClient } from '../../clients/user.client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userServiceClient: UserServiceClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret', 'your-secret-key'),
    });
  }

  async validate(payload: any) {
    // Validate JWT payload structure
    if (!payload.sub || !payload.username) {
      this.logger.warn('Invalid JWT payload: missing sub or username');
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const userId = payload.sub;

    try {
      // Integrate with User Service to validate token and ensure user exists
      const userExists = await this.userServiceClient.doesUserExist(userId);

      if (!userExists) {
        this.logger.warn(`User ${userId} not found in User Service`);
        throw new UnauthorizedException('User not found');
      }

      // Return user object that will be attached to request.user
      return {
        id: userId,
        username: payload.username,
        roles: payload.roles || [],
        email: payload.email,
        // Add any other user properties from JWT payload
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate user ${userId}: ${errorMessage}`);

      // If User Service is unavailable, we can still trust the JWT for now
      // but log the issue for monitoring
      if (
        errorMessage.includes('Network error') ||
        errorMessage.includes('timeout')
      ) {
        this.logger.warn(
          `User Service unavailable, trusting JWT for user ${userId}`,
        );
        return {
          id: userId,
          username: payload.username,
          roles: payload.roles || [],
          email: payload.email,
        };
      }

      throw new UnauthorizedException('Token validation failed');
    }
  }
}
