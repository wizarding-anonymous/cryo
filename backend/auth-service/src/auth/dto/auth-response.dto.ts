import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique user identifier',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  name: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last login timestamp',
    nullable: true,
  })
  lastLoginAt?: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Last account update timestamp',
  })
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    type: UserResponseDto,
    description: 'User information (password excluded)',
  })
  user: UserResponseDto;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMTQwMDAsImV4cCI6MTcwNTMxNzYwMH0.example_signature',
    description: 'JWT access token for API authentication',
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTcwNTMxNDAwMCwiZXhwIjoxNzA1OTE4ODAwfQ.example_refresh_signature',
    description: 'Refresh token for obtaining new access tokens',
  })
  refresh_token: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Session identifier',
  })
  session_id: string;

  @ApiProperty({
    example: 3600,
    description: 'Access token expiration time in seconds',
  })
  expires_in: number;
}

export class TokenRefreshResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MDUzMTQwMDAsImV4cCI6MTcwNTMxNzYwMH0.new_signature',
    description: 'New JWT access token',
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTcwNTMxNDAwMCwiZXhwIjoxNzA1OTE4ODAwfQ.new_refresh_signature',
    description: 'New refresh token (token rotation for security)',
  })
  refresh_token: string;

  @ApiProperty({
    example: 3600,
    description: 'New access token expiration time in seconds',
  })
  expires_in: number;
}

export class TokenValidationResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the token is valid',
  })
  valid: boolean;

  @ApiProperty({
    type: UserResponseDto,
    description: 'User information if token is valid',
    nullable: true,
  })
  user?: UserResponseDto;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Session ID associated with the token',
    nullable: true,
  })
  sessionId?: string;

  @ApiProperty({
    example: 1705317600,
    description: 'Token expiration timestamp (Unix timestamp)',
    nullable: true,
  })
  expiresAt?: number;
}

export class SessionInfoDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Session identifier',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User identifier',
  })
  userId: string;

  @ApiProperty({
    example: '192.168.1.100',
    description: 'Client IP address',
  })
  ipAddress: string;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    description: 'Client user agent string',
  })
  userAgent: string;

  @ApiProperty({
    example: true,
    description: 'Whether the session is currently active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Session creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-16T10:30:00.000Z',
    description: 'Session expiration timestamp',
  })
  expiresAt: Date;

  @ApiProperty({
    example: '2024-01-15T12:45:00.000Z',
    description: 'Last access timestamp',
  })
  lastAccessedAt: Date;
}

export class SessionStatsDto {
  @ApiProperty({
    example: 150,
    description: 'Total number of active sessions across all users',
  })
  totalActiveSessions: number;

  @ApiProperty({
    example: 45,
    description: 'Total number of expired sessions',
  })
  totalExpiredSessions: number;

  @ApiProperty({
    example: { 'user1': 3, 'user2': 2, 'user3': 1 },
    description: 'Number of sessions per user ID',
    additionalProperties: { type: 'number' },
  })
  sessionsPerUser: Record<string, number>;
}

export class ConcurrentSessionInfoDto {
  @ApiProperty({
    example: 3,
    description: 'Current number of active sessions for the user',
  })
  currentSessionCount: number;

  @ApiProperty({
    example: 5,
    description: 'Maximum allowed concurrent sessions per user',
  })
  maxAllowedSessions: number;

  @ApiProperty({
    example: false,
    description: 'Whether the user has reached the session limit',
  })
  isAtLimit: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the user can create a new session',
  })
  canCreateNewSession: boolean;

  @ApiProperty({
    example: 3600000,
    description: 'Age of the oldest session in milliseconds',
    nullable: true,
  })
  oldestSessionAge?: number;

  @ApiProperty({
    example: 2,
    description: 'Number of sessions that can be created before hitting the limit',
  })
  sessionsUntilLimit: number;
}