import { HttpException, HttpStatus } from '@nestjs/common';

export class SecurityError extends HttpException {
  constructor(message: string, riskScore?: number) {
    super(
      {
        message,
        riskScore,
        code: 'SECURITY_CHECK_FAILED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class BlockedIPError extends HttpException {
  constructor(ip: string, blockedUntil?: Date) {
    super(
      {
        message: 'IP address is blocked',
        ip,
        blockedUntil,
        code: 'IP_BLOCKED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SuspiciousActivityError extends HttpException {
  constructor(userId: string, activityType: string) {
    super(
      {
        message: 'Suspicious activity detected',
        userId,
        activityType,
        code: 'SUSPICIOUS_ACTIVITY',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class RateLimitExceededError extends HttpException {
  constructor(limit: number, resetTime: Date) {
    super(
      {
        message: 'Rate limit exceeded',
        limit,
        resetTime,
        code: 'RATE_LIMIT_EXCEEDED',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}