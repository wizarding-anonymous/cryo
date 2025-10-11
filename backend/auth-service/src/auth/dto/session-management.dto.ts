import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export enum SecurityEventType {
  PASSWORD_CHANGE = 'password_change',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ACCOUNT_COMPROMISE = 'account_compromise',
  ADMIN_ACTION = 'admin_action',
}

export class InvalidateSessionsForSecurityDto {
  @ApiProperty({
    enum: SecurityEventType,
    example: SecurityEventType.PASSWORD_CHANGE,
    description: 'Type of security event triggering session invalidation',
  })
  @IsEnum(SecurityEventType, { 
    message: 'Тип события безопасности должен быть одним из: password_change, suspicious_activity, account_compromise, admin_action' 
  })
  securityEventType: SecurityEventType;

  @ApiProperty({
    example: false,
    description: 'Whether to exclude current session from invalidation (e.g., for password changes)',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'excludeCurrentSession должно быть булевым значением' })
  excludeCurrentSession?: boolean;
}

export class SessionListResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Total number of sessions returned',
  })
  total: number;

  @ApiProperty({
    example: 2,
    description: 'Number of active sessions',
  })
  active: number;

  @ApiProperty({
    example: 1,
    description: 'Number of inactive/expired sessions',
  })
  inactive: number;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440001' },
        userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        ipAddress: { type: 'string', example: '192.168.1.100' },
        userAgent: { type: 'string', example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        expiresAt: { type: 'string', format: 'date-time', example: '2024-01-16T10:30:00.000Z' },
        lastAccessedAt: { type: 'string', format: 'date-time', example: '2024-01-15T12:45:00.000Z' },
      },
    },
    description: 'List of user sessions',
  })
  sessions: Array<{
    id: string;
    userId: string;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    createdAt: Date;
    expiresAt: Date;
    lastAccessedAt: Date;
  }>;
}