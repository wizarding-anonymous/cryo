import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit-action';
export const AUDIT_RESOURCE_KEY = 'audit-resource';

// Audit actions enum
export const AuditActions = {
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const;

// Audit resources enum
export const AuditResources = {
  USER: 'USER',
  PROFILE: 'PROFILE',
  SESSION: 'SESSION',
  ROLE: 'ROLE',
} as const;

export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
export const AuditResource = (resource: string) => SetMetadata(AUDIT_RESOURCE_KEY, resource);

// Combined decorator for convenience
export const Audit = (action: string, resource: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(AUDIT_ACTION_KEY, action)(target, propertyKey, descriptor);
    SetMetadata(AUDIT_RESOURCE_KEY, resource)(target, propertyKey, descriptor);
  };
};
