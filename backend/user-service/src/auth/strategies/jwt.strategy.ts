import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RedisService } from '../../common/redis/redis.service';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true, // Pass request to the validate method
    });
  }

  /**
   * Validates the JWT payload and checks if the token has been blacklisted.
   * @param req The incoming request object.
   * @param payload The decoded JWT payload.
   * @returns The user object if the token is valid and not blacklisted.
   * @throws UnauthorizedException if the token is blacklisted.
   */
  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<{ userId: string; email: string }> {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException(
          'Токен недействителен (в черном списке)',
        );
      }
    }

    return { userId: payload.sub, email: payload.email };
  }
}
