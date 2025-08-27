import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Only apply to integration endpoints
    if (!this.isIntegrationEndpoint(req.path)) {
      return next();
    }

    const apiKey = req.get('X-API-Key');
    const validApiKeys = this.getValidApiKeys();

    if (!apiKey) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'API key is required for integration endpoints',
          error: 'Missing API Key',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!validApiKeys.includes(apiKey)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Invalid API key',
          error: 'Invalid API Key',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Add service identification to request
    req['serviceId'] = this.getServiceIdFromApiKey(apiKey);
    next();
  }

  private isIntegrationEndpoint(path: string): boolean {
    return (
      (path.includes('/api/v1/developers/') && path.includes('/basic-profile')) ||
      (path.includes('/api/v1/publishers/') && path.includes('/basic-profile'))
    );
  }

  private getValidApiKeys(): string[] {
    // In production, these would come from environment variables or a secure store
    return [
      this.configService.get<string>('DEVELOPER_PORTAL_API_KEY'),
      this.configService.get<string>('INTERNAL_SERVICE_API_KEY'),
    ].filter(Boolean);
  }

  private getServiceIdFromApiKey(apiKey: string): string {
    const developerPortalKey = this.configService.get<string>('DEVELOPER_PORTAL_API_KEY');
    const internalServiceKey = this.configService.get<string>('INTERNAL_SERVICE_API_KEY');

    if (apiKey === developerPortalKey) {
      return 'developer-portal-service';
    }
    if (apiKey === internalServiceKey) {
      return 'internal-service';
    }
    
    return 'unknown';
  }
}