import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthValidationService } from '../auth-validation.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authValidation: AuthValidationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) return true;
    try {
      const user = await this.authValidation.validateBearerToken(authHeader);
      req.user = user;
      return true;
    } catch (e) {
      // Token provided but invalid → 401 to avoid silent failures
      throw new UnauthorizedException('Invalid token');
    }
  }
}
