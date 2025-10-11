import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests-only',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      username: payload.username || payload.email,
      email: payload.email,
      roles: payload.roles || ['user'],
    };
  }
}