import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // Allow all in test environment to enable E2E flows without external S2S auth
    if (nodeEnv.toLowerCase() === 'test') {
      this.logger.debug(
        'InternalAuthGuard: Allowing access in test environment',
      );
      return true;
    }

    // Method 1: Check if request has a user with internal role (service-to-service via JWT)
    const user = request.user as { id?: string; roles?: string[] } | undefined;
    if (
      user?.roles?.some(
        (role) => role === 'internal-service' || role === 'admin',
      )
    ) {
      this.logger.debug(
        `InternalAuthGuard: User ${user.id} authorized with internal role`,
      );
      return true;
    }

    // Method 2: Check for internal API key in headers
    const headers = request.headers || {};
    const headerKey =
      headers['x-internal-api-key'] ||
      headers['x-internal-key'] ||
      headers['authorization']?.replace('Bearer ', '');

    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (expectedKey && headerKey && headerKey === expectedKey) {
      this.logger.debug('InternalAuthGuard: Authorized via internal API key');
      return true;
    }

    // Method 3: Check for service-to-service token in Authorization header
    const authHeader = headers['authorization'];
    if (authHeader?.startsWith('Internal ')) {
      const token = authHeader.replace('Internal ', '');
      if (expectedKey && token === expectedKey) {
        this.logger.debug('InternalAuthGuard: Authorized via internal token');
        return true;
      }
    }

    this.logger.warn(
      `InternalAuthGuard: Unauthorized access attempt to internal endpoint from ${request.ip || 'unknown IP'}`,
    );

    throw new UnauthorizedException(
      'This endpoint is for internal service communication only',
    );
  }
}
