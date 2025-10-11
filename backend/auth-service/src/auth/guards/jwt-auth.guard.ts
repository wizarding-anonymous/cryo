import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * This guard triggers the JwtStrategy and populates req.user
 * with the payload validated from the JWT.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}