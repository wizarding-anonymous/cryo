import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
      const isBlacklisted = await this.cacheManager.get(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Токен недействителен (в черном списке)');
      }
    }

    return { userId: payload.sub, email: payload.email };
  }
}
