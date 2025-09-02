import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

// This is a simplified mock strategy for internal microservice communication.
// It assumes an API Gateway has already validated the JWT and is passing user info
// in a secure header. A more robust implementation would validate the JWT token itself.

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // For this mock, we don't have a real token to expire
      secretOrKey: 'mockSecret', // This should be loaded from config in a real app
    });
  }

  async validate(payload: any) {
    // In a real scenario, the payload would be the decoded JWT.
    // We might fetch the user from the database here to attach a full user object.
    // For now, we'll just return the payload as is.
    if (!payload) {
        throw new UnauthorizedException();
    }
    // The payload should contain id, roles, etc.
    return payload;
  }
}

// Example of a strategy that reads from a header (if gateway provides it)
/*
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';

@Injectable()
export class JwtFromHeaderStrategy extends PassportStrategy(Strategy, 'jwt-from-header') {
    constructor() {
        super();
    }

    async validate(req: Request): Promise<any> {
        const userPayloadHeader = req.headers['x-user-payload'];

        if (!userPayloadHeader) {
            throw new UnauthorizedException('User payload header not found');
        }

        try {
            const user = JSON.parse(userPayloadHeader as string);
            return user;
        } catch (error) {
            throw new UnauthorizedException('Invalid user payload format');
        }
    }
}
*/
