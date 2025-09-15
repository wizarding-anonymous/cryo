import { Module } from '@nestjs/common';
import { SecurityController } from '../src/modules/security/security.controller';
import { LogsController } from '../src/modules/logs/logs.controller';
import { AlertsController } from '../src/modules/alerts/alerts.controller';
import { SecurityService } from '../src/modules/security/security.service';
import { LoggingService } from '../src/modules/logs/logging.service';
import { AlertsService } from '../src/modules/alerts/alerts.service';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { RateLimitService } from '../src/modules/security/rate-limit.service';
import { AdminGuard } from '../src/common/guards/admin.guard';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { AuthService } from '../src/common/auth/auth.service';
import { Reflector } from '@nestjs/core';

@Module({
  controllers: [SecurityController, LogsController, AlertsController],
  providers: [
    Reflector,
    { provide: SecurityService, useValue: {
      checkLoginSecurity: async () => ({ allowed: true, riskScore: 20 }),
      checkTransactionSecurity: async () => ({ allowed: true, riskScore: 25 }),
      blockIP: async () => undefined,
      isIPBlocked: async () => false,
    } },
    { provide: LoggingService, useValue: {
      logSecurityEvent: async () => ({}),
      getSecurityLogs: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
      getUserSecurityEvents: async () => ([]),
    } },
    { provide: AlertsService, useValue: {
      getAlerts: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
      getActiveAlerts: async () => ([]),
      resolveAlert: async () => undefined,
    } },
    RateLimitGuard,
    { provide: RateLimitService, useValue: { checkRateLimit: async () => ({ allowed: true, remaining: 100, resetInSeconds: 60 }) } },
    AdminGuard,
    AuthGuard,
    { provide: AuthService, useValue: { verifyBearerToken: async () => ({ id: 'admin', isAdmin: true }) } },
  ],
})
export class TestAppModule {}

