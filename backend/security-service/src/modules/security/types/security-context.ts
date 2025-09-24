export interface SecurityContext {
  ip?: string;
  userAgent?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}
