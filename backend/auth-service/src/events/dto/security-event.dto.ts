export class SecurityEventDto {
  userId: string;
  type: 'registration' | 'login' | 'logout' | 'logout_rollback' | 'failed_login' | 'suspicious_activity' | 'all_sessions_invalidated' | 'security_session_invalidation' | 'brute_force_attack';
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;

  constructor(data: Partial<SecurityEventDto>) {
    Object.assign(this, data);
  }
}