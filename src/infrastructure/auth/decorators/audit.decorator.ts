import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit-action';
export const AUDIT_RESOURCE_KEY = 'audit-resource';

export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
export const AuditResource = (resource: string) => SetMetadata(AUDIT_RESOURCE_KEY, resource);
