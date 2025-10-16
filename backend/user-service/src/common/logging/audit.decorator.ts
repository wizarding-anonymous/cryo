import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const AUDIT_METADATA_KEY = 'audit_metadata';

export interface AuditMetadata {
  operation: string;
  resource: string;
  sensitiveData?: boolean;
  complianceRelevant?: boolean;
  gdprRelevant?: boolean;
  logChanges?: boolean;
  skipAudit?: boolean;
}

/**
 * Decorator to mark methods for automatic audit logging
 * @param metadata Audit configuration
 */
export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA_KEY, metadata);

/**
 * Parameter decorator to extract audit context from request
 */
export const AuditContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    return {
      correlationId: (request as any).correlationId,
      userId: (request as any).user?.id,
      ipAddress: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
      requestId: (request as any).id,
    };
  },
);

/**
 * Audit operation types for common CRUD operations
 */
export const AuditOperations = {
  USER_CREATE: 'user_create',
  USER_READ: 'user_read',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_BULK_READ: 'user_bulk_read',
  USER_BULK_UPDATE: 'user_bulk_update',
  USER_BULK_DELETE: 'user_bulk_delete',
  PROFILE_VIEW: 'profile_view',
  PROFILE_UPDATE: 'profile_update',
  PROFILE_DELETE: 'profile_delete',
  AVATAR_UPLOAD: 'avatar_upload',
  AVATAR_DELETE: 'avatar_delete',
  PREFERENCES_UPDATE: 'preferences_update',
  PRIVACY_SETTINGS_UPDATE: 'privacy_settings_update',
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
} as const;

/**
 * Resource types for audit logging
 */
export const AuditResources = {
  USER: 'user',
  PROFILE: 'profile',
  AVATAR: 'avatar',
  PREFERENCES: 'preferences',
  PRIVACY_SETTINGS: 'privacy_settings',
  BATCH_OPERATION: 'batch_operation',
} as const;