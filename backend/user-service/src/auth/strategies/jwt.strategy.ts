import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

// Define the shape of the JWT payload
interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Passport first verifies the JWT's signature and expiration, then calls this method.
   * The return value of this method is attached to the Request object as `req.user`.
   * @param payload The decoded JWT payload.
   * @returns An object with the user's ID and email.
   */
  async validate(payload: JwtPayload): Promise<{ userId: string; email: string }> {
    // In a more complex scenario, you might use the payload.sub (userId)
    // to fetch the full user object from the database again here.
    // For this MVP, returning the payload directly is sufficient.
    return { userId: payload.sub, email: payload.email };
  }
}
