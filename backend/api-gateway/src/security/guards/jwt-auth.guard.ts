import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthValidationService } from '../auth-validation.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authValidation: AuthValidationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }
    const user = await this.authValidation.validateBearerToken(authHeader);
    req.user = user;
    return true;
  }
}
