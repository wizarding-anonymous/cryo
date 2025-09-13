import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret', 'default_secret'), // Added default for safety
    });
  }

  async validate(payload: any) {
    // In a real app, you might do a DB lookup to ensure the user exists,
    // or check against a revocation list.
    // For this service, we trust the JWT payload issued by the auth service.
    if (!payload.sub || !payload.username) {
        throw new UnauthorizedException('Invalid JWT payload');
    }
    // The 'sub' field from the JWT is typically the user's ID.
    return { id: payload.sub, username: payload.username, roles: payload.roles || [] };
  }
}
