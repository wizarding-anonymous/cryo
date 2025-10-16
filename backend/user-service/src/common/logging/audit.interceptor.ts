import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    // Skip audit if not configured or explicitly disabled
    if (!auditMetadata || auditMetadata.skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Extract context information
    const auditContext = {
      correlationId: (request as any).correlationId || 'unknown',
      userId: (request as any).user?.id || 'anonymous',
      ipAddress: request.ip || request.connection.remoteAddress || 'unknown',
      userAgent: request.get('User-Agent') || 'unknown',
      requestId: (request as any).id,
    };

    // Extract resource ID from request parameters
    const resourceId = this.extractResourceId(request, auditMetadata.resource);

    // Store original request body for change tracking
    const originalBody = auditMetadata.logChanges ? { ...request.body } : undefined;

    return next.handle().pipe(
      tap(async (responseData) => {
        const duration = Date.now() - startTime;
        
        try {
          // Extract changes if configured
          const changes = auditMetadata.logChanges 
            ? this.extractChanges(originalBody, responseData, auditMetadata.resource)
            : undefined;

          // Log the successful operation
          await this.auditService.logUserOperation(
            auditMetadata.operation,
            auditContext.userId,
            auditContext.correlationId,
            auditContext.ipAddress,
            auditContext.userAgent,
            true, // success
            duration,
            {
              resource: auditMetadata.resource,
              resourceId,
              method: request.method,
              url: request.url,
              statusCode: response.statusCode,
              sensitiveData: auditMetadata.sensitiveData,
              complianceRelevant: auditMetadata.complianceRelevant,
              gdprRelevant: auditMetadata.gdprRelevant,
              requestSize: JSON.stringify(request.body || {}).length,
              responseSize: JSON.stringify(responseData || {}).length,
            },
            changes,
          );

          // Log sensitive data access if configured
          if (auditMetadata.sensitiveData) {
            this.auditService.logSensitiveDataAccess(
              'PII',
              this.mapMethodToOperation(request.method),
              auditContext.userId,
              auditContext.correlationId,
              auditContext.ipAddress,
              auditContext.userAgent,
              resourceId,
              `${auditMetadata.operation} operation`,
            );
          }

        } catch (error) {
          this.logger.error(
            `Failed to log audit event for operation ${auditMetadata.operation}`,
            error.stack,
          );
        }
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;
        
        try {
          // Log the failed operation
          await this.auditService.logUserOperation(
            auditMetadata.operation,
            auditContext.userId,
            auditContext.correlationId,
            auditContext.ipAddress,
            auditContext.userAgent,
            false, // success = false
            duration,
            {
              resource: auditMetadata.resource,
              resourceId,
              method: request.method,
              url: request.url,
              error: error.message,
              errorType: error.constructor.name,
              statusCode: error.status || 500,
              sensitiveData: auditMetadata.sensitiveData,
              complianceRelevant: auditMetadata.complianceRelevant,
              gdprRelevant: auditMetadata.gdprRelevant,
            },
          );
        } catch (auditError) {
          this.logger.error(
            `Failed to log audit event for failed operation ${auditMetadata.operation}`,
            auditError.stack,
          );
        }

        return throwError(() => error);
      }),
    );
  }

  /**
   * Extracts resource ID from request parameters
   */
  private extractResourceId(request: Request, resource: string): string | undefined {
    // Common patterns for resource IDs
    const idFields = ['id', 'userId', 'profileId', `${resource}Id`];
    
    for (const field of idFields) {
      if (request.params[field]) {
        return request.params[field];
      }
    }

    // Check in request body
    if (request.body) {
      for (const field of idFields) {
        if (request.body[field]) {
          return request.body[field];
        }
      }
    }

    // Check in query parameters
    if (request.query) {
      for (const field of idFields) {
        if (request.query[field]) {
          return request.query[field] as string;
        }
      }
    }

    return undefined;
  }

  /**
   * Extracts changes between original and updated data
   */
  private extractChanges(
    originalData: any,
    responseData: any,
    resource: string,
  ): Record<string, { from: any; to: any }> | undefined {
    if (!originalData || !responseData) {
      return undefined;
    }

    const changes: Record<string, { from: any; to: any }> = {};

    // Extract the actual data from response (might be wrapped in a response object)
    const updatedData = responseData.data || responseData;

    if (typeof updatedData === 'object' && updatedData !== null) {
      for (const key in originalData) {
        if (originalData[key] !== updatedData[key]) {
          changes[key] = {
            from: originalData[key],
            to: updatedData[key],
          };
        }
      }

      // Check for new fields in updated data
      for (const key in updatedData) {
        if (!(key in originalData) && updatedData[key] !== undefined) {
          changes[key] = {
            from: undefined,
            to: updatedData[key],
          };
        }
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Maps HTTP method to data access operation
   */
  private mapMethodToOperation(method: string): 'READ' | 'WRITE' | 'DELETE' | 'EXPORT' {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'READ';
      case 'POST':
      case 'PUT':
      case 'PATCH':
        return 'WRITE';
      case 'DELETE':
        return 'DELETE';
      default:
        return 'READ';
    }
  }
}