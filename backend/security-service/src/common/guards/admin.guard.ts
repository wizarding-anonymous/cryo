import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // If AuthGuard already ran, use its result
    let user = req.user;
    if (!user) {
      user = await this.auth.verifyBearerToken(req.headers['authorization']);
    }
    
    // If no user found, return 401 (Unauthorized)
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    const roles: string[] = (user?.roles ?? []) as string[];
    const isAdmin = user?.isAdmin === true || roles.includes('admin') || user?.role === 'admin';
    
    // If user exists but not admin, return 403 (Forbidden)
    if (!isAdmin) {
      throw new ForbiddenException('Admin privileges required');
    }
    
    req.user = user;
    return true;
  }
}
