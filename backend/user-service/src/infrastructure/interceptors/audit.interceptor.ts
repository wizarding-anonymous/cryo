import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../application/services/audit.service';
import { AUDIT_ACTION_KEY, AUDIT_RESOURCE_KEY } from '../auth/decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const auditAction = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const auditResource = this.reflector.get<string>(AUDIT_RESOURCE_KEY, context.getHandler());

    if (!auditAction) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async response => {
        await this.auditService.logAction({
          userId: request.user?.userId, // Assuming userId is on the user object from the guard
          action: auditAction,
          resourceType: auditResource,
          resourceId: request.params?.id,
          details: {
            method: request.method,
            url: request.originalUrl,
            body: request.body,
            responseStatus: context.switchToHttp().getResponse().statusCode,
          },
          ipAddress: request.ip,
          userAgent: request.get('User-Agent'),
        });
      }),
    );
  }
}
