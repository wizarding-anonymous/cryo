import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * This guard triggers the LocalStrategy and populates req.user.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
