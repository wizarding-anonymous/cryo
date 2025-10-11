import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseOperationsService, DatabaseOperationResult } from './database-operations.service';
import { Session, LoginAttempt, TokenBlacklist, SecurityEvent } from '../entities';

export interface SessionCreationData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

export interface LoginAttemptData {
  email: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  successful: boolean;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface SecurityEventData {
  userId: string;
  type: SecurityEvent['type'];
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: SecurityEvent['severity'];
}

@Injectable()
export class AuthDatabaseService {
  private readonly logger = new Logger(AuthDatabaseService.name);

  constructor(
    private readonly databaseOperations: DatabaseOperationsService,
  ) {}

  /**
   * Handle database operation result and throw appropriate exceptions
   */
  private handleDatabaseResult<T>(
    result: DatabaseOperationResult<T>,
    operation: string,
  ): T {
    if (!result.success) {
      this.logger.error(`Database operation failed: ${operation}`, {
        error: result.error,
        code: result.code,
      });

      switch (result.code) {
        case 'DUPLICATE_ENTRY':
          throw new BadRequestException('Duplicate entry found');
        case 'FOREIGN_KEY_VIOLATION':
          throw new BadRequestException('Invalid reference');
        case 'NOT_NULL_VIOLATION':
          throw new BadRequestException('Required field missing');
        case 'CONNECTION_ERROR':
        case 'TOO_MANY_CONNECTIONS':
          throw new InternalServerErrorException('Database connection error');
        default:
          throw new InternalServerErrorException(`Database operation failed: ${result.error}`);
      }
    }

    return result.data as T;
  }

  // Session Management
  async createUserSession(sessionData: SessionCreationData): Promise<Session> {
    const result = await this.databaseOperations.createSession({
      userId: sessionData.userId,
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      expiresAt: sessionData.expiresAt,
      isActive: true,
    });

    return this.handleDatabaseResult(result, 'createUserSession');
  }

  async findActiveSessionById(sessionId: string): Promise<Session | null> {
    const result = await this.databaseOperations.findSessionById(sessionId);
    const session = this.handleDatabaseResult(result, 'findActiveSessionById');
    
    return session && session.isActive ? session : null;
  }

  async findActiveSessionsByUserId(userId: string): Promise<Session[]> {
    const result = await this.databaseOperations.findSessionsByUserId(userId);
    return this.handleDatabaseResult(result, 'findActiveSessionsByUserId');
  }

  async findSessionByAccessToken(accessToken: string): Promise<Session | null> {
    const result = await this.databaseOperations.findSessionByAccessToken(accessToken);
    return this.handleDatabaseResult(result, 'findSessionByAccessToken');
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const result = await this.databaseOperations.findSessionByRefreshToken(refreshToken);
    return this.handleDatabaseResult(result, 'findSessionByRefreshToken');
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const result = await this.databaseOperations.updateSessionLastAccessed(sessionId);
    this.handleDatabaseResult(result, 'updateSessionActivity');
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const result = await this.databaseOperations.deactivateSession(sessionId);
    this.handleDatabaseResult(result, 'invalidateSession');
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const result = await this.databaseOperations.deactivateAllUserSessions(userId);
    this.handleDatabaseResult(result, 'invalidateAllUserSessions');
  }

  // Login Attempt Tracking
  async recordLoginAttempt(attemptData: LoginAttemptData): Promise<LoginAttempt> {
    const result = await this.databaseOperations.createLoginAttempt({
      email: attemptData.email,
      userId: attemptData.userId,
      ipAddress: attemptData.ipAddress,
      userAgent: attemptData.userAgent,
      successful: attemptData.successful,
      failureReason: attemptData.failureReason,
      metadata: attemptData.metadata,
    });

    return this.handleDatabaseResult(result, 'recordLoginAttempt');
  }

  async getRecentFailedLoginsByEmail(email: string, minutesBack: number = 15): Promise<number> {
    const result = await this.databaseOperations.countFailedLoginAttemptsByEmail(email, minutesBack);
    return this.handleDatabaseResult(result, 'getRecentFailedLoginsByEmail');
  }

  async getRecentFailedLoginsByIp(ipAddress: string, minutesBack: number = 15): Promise<number> {
    const result = await this.databaseOperations.countFailedLoginAttemptsByIp(ipAddress, minutesBack);
    return this.handleDatabaseResult(result, 'getRecentFailedLoginsByIp');
  }

  async getRecentLoginAttemptsByEmail(email: string, minutesBack: number = 15): Promise<LoginAttempt[]> {
    const result = await this.databaseOperations.findRecentLoginAttemptsByEmail(email, minutesBack);
    return this.handleDatabaseResult(result, 'getRecentLoginAttemptsByEmail');
  }

  async getRecentLoginAttemptsByIp(ipAddress: string, minutesBack: number = 15): Promise<LoginAttempt[]> {
    const result = await this.databaseOperations.findRecentLoginAttemptsByIp(ipAddress, minutesBack);
    return this.handleDatabaseResult(result, 'getRecentLoginAttemptsByIp');
  }

  // Token Blacklist Management
  async blacklistToken(
    tokenHash: string,
    userId: string,
    reason: TokenBlacklist['reason'],
    expiresAt: Date,
    metadata?: Record<string, any>,
  ): Promise<TokenBlacklist> {
    const result = await this.databaseOperations.blacklistToken(
      tokenHash,
      userId,
      reason,
      expiresAt,
      metadata,
    );

    return this.handleDatabaseResult(result, 'blacklistToken');
  }

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const result = await this.databaseOperations.isTokenBlacklisted(tokenHash);
    return this.handleDatabaseResult(result, 'isTokenBlacklisted');
  }

  async blacklistAllUserTokens(
    userId: string,
    reason: TokenBlacklist['reason'] = 'security',
    metadata?: Record<string, any>,
  ): Promise<void> {
    const result = await this.databaseOperations.blacklistAllUserTokens(userId, reason, metadata);
    this.handleDatabaseResult(result, 'blacklistAllUserTokens');
  }

  async getUserBlacklistedTokens(userId: string): Promise<TokenBlacklist[]> {
    const result = await this.databaseOperations.findBlacklistedTokensByUserId(userId);
    return this.handleDatabaseResult(result, 'getUserBlacklistedTokens');
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.databaseOperations.cleanupExpiredTokens();
    return this.handleDatabaseResult(result, 'cleanupExpiredTokens');
  }

  // Security Event Logging
  async logSecurityEvent(eventData: SecurityEventData): Promise<SecurityEvent> {
    const result = await this.databaseOperations.logSecurityEvent(
      eventData.userId,
      eventData.type,
      eventData.ipAddress,
      eventData.userAgent,
      eventData.metadata,
      eventData.severity || 'low',
    );

    return this.handleDatabaseResult(result, 'logSecurityEvent');
  }

  async getUserSecurityEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    const result = await this.databaseOperations.findSecurityEventsByUserId(userId, limit);
    return this.handleDatabaseResult(result, 'getUserSecurityEvents');
  }

  async getUnprocessedSecurityEvents(): Promise<SecurityEvent[]> {
    const result = await this.databaseOperations.findUnprocessedSecurityEvents();
    return this.handleDatabaseResult(result, 'getUnprocessedSecurityEvents');
  }

  async markSecurityEventProcessed(eventId: string): Promise<void> {
    const result = await this.databaseOperations.markSecurityEventAsProcessed(eventId);
    this.handleDatabaseResult(result, 'markSecurityEventProcessed');
  }

  async markMultipleSecurityEventsProcessed(eventIds: string[]): Promise<void> {
    const result = await this.databaseOperations.markMultipleSecurityEventsAsProcessed(eventIds);
    this.handleDatabaseResult(result, 'markMultipleSecurityEventsProcessed');
  }

  async countUserSecurityEventsByType(
    userId: string,
    type: SecurityEvent['type'],
    hoursBack: number = 24,
  ): Promise<number> {
    const result = await this.databaseOperations.countSecurityEventsByUserAndType(userId, type, hoursBack);
    return this.handleDatabaseResult(result, 'countUserSecurityEventsByType');
  }

  // Maintenance and Monitoring
  async performDatabaseMaintenance(): Promise<{
    expiredSessions: number;
    expiredTokens: number;
    processedEvents: number;
  }> {
    const result = await this.databaseOperations.performMaintenanceTasks();
    return this.handleDatabaseResult(result, 'performDatabaseMaintenance');
  }

  async getDatabaseStatistics(): Promise<{
    activeSessions: number;
    totalLoginAttempts24h: number;
    failedLoginAttempts24h: number;
    blacklistedTokens: number;
    unprocessedSecurityEvents: number;
  }> {
    const result = await this.databaseOperations.getDatabaseStatistics();
    return this.handleDatabaseResult(result, 'getDatabaseStatistics');
  }

  // Utility Methods for Business Logic
  async isUserAccountLocked(userId: string, lockoutThreshold: number = 5, lockoutPeriodHours: number = 1): Promise<boolean> {
    const failedAttempts = await this.countUserSecurityEventsByType(userId, 'failed_login', lockoutThreshold);
    return failedAttempts >= lockoutThreshold;
  }

  async shouldRateLimitUser(userId: string, maxAttempts: number = 10, periodMinutes: number = 15): Promise<boolean> {
    // This would need to be implemented based on login attempts or security events
    const recentEvents = await this.countUserSecurityEventsByType(userId, 'failed_login', periodMinutes / 60);
    return recentEvents >= maxAttempts;
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const sessions = await this.findActiveSessionsByUserId(userId);
    return sessions.length;
  }

  async enforceMaxSessionLimit(userId: string, maxSessions: number = 5): Promise<void> {
    const sessions = await this.findActiveSessionsByUserId(userId);
    
    if (sessions.length >= maxSessions) {
      // Sort by creation date and deactivate oldest sessions
      const sortedSessions = sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const sessionsToDeactivate = sortedSessions.slice(0, sessions.length - maxSessions + 1);
      
      for (const session of sessionsToDeactivate) {
        await this.invalidateSession(session.id);
      }
    }
  }
}