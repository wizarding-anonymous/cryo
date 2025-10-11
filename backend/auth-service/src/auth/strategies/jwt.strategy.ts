import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenService } from '../../token/token.service';
import { UserServiceClient } from '../../common/http-client/user-service.client';

interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly userServiceClient: UserServiceClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Requirement 5.1: Validate token expiration
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true, // Pass request to the validate method
    });
  }

  /**
   * Validates the JWT payload according to requirements 5.1, 5.2, and 5.4:
   * - 5.1: Validates token signature and expiration (handled by passport-jwt)
   * - 5.2: Checks if token is blacklisted
   * - 5.4: Verifies user still exists and is not deleted
   * 
   * @param req The incoming request object
   * @param payload The decoded JWT payload (signature and expiration already verified)
   * @returns The user object if the token is valid and not blacklisted
   * @throws UnauthorizedException if validation fails
   */
  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<{ userId: string; email: string }> {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        this.logger.warn('Missing or invalid Authorization header');
        throw new UnauthorizedException('Отсутствует токен авторизации');
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        this.logger.warn('Empty token in Authorization header');
        throw new UnauthorizedException('Пустой токен авторизации');
      }

      // Requirement 5.2: Check if token is blacklisted
      // This includes checking both Redis and local database
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        this.logger.warn(`Blacklisted token used for user: ${payload.sub}`);
        throw new UnauthorizedException('Токен недействителен (в черном списке)');
      }

      // Check if all user tokens have been invalidated (bulk invalidation)
      const allTokensInvalidated = await this.tokenService.areAllUserTokensInvalidated(payload.sub);
      if (allTokensInvalidated) {
        this.logger.warn(`All tokens invalidated for user: ${payload.sub}`);
        throw new UnauthorizedException('Все токены пользователя недействительны');
      }

      // Requirement 5.4: Verify user still exists and is not deleted
      // This call uses Circuit Breaker pattern for resilience
      const user = await this.userServiceClient.findById(payload.sub);
      if (!user) {
        this.logger.warn(`User not found or deleted: ${payload.sub}`);
        throw new UnauthorizedException('Пользователь не найден или удален');
      }

      // Validate payload structure
      if (!payload.sub || !payload.email) {
        this.logger.warn('Invalid token payload structure');
        throw new UnauthorizedException('Неверная структура токена');
      }

      // Log successful validation for monitoring
      this.logger.debug(`Token validated successfully for user: ${payload.sub}`);

      return { 
        userId: payload.sub, 
        email: payload.email 
      };

    } catch (error) {
      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error('Unexpected error during token validation', error.stack);
      throw new UnauthorizedException('Ошибка валидации токена');
    }
  }
}