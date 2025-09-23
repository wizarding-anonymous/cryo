import { SecurityEventType } from '../../common/enums/security-event-type.enum';

// Internal DTO, not exposed via API, no validation needed
export class CreateSecurityEventDto {
  type!: SecurityEventType;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  data?: Record<string, unknown> | null;
  riskScore?: number | null;
}
