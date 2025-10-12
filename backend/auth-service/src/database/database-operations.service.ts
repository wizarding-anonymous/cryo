import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import {
  SessionRepository,
  LoginAttemptRepository,
  TokenBlacklistRepository,
  SecurityEventRepository,
} from '../repositories';
import {
  Session,
  LoginAttempt,
  TokenBlacklist,
  SecurityEvent,
} from '../entities';

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface TransactionCallback<T> {
  (queryRunner: QueryRunner): Promise<T>;
}

@Injectable()
export class DatabaseOperationsService {
  private readonly logger = new Logger(DatabaseOperationsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly sessionRepository: SessionRepository,
    private readonly loginAttemptRepository: LoginAttemptRepository,
    private readonly tokenBlacklistRepository: TokenBlacklistRepository,
    private readonly securityEventRepository: SecurityEventRepository,
  ) {}

  /**
   * Execute operation with proper error handling and logging
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, any>,
  ): Promise<DatabaseOperationResult<T>> {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      this.logger.debug(`${operationName} completed in ${duration}ms`, {
        operation: operationName,
        duration,
        context,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`${operationName} failed`, {
        operation: operationName,
        error: error.message,
        stack: error.stack,
        context,
      });

      return {
        success: false,
        error: error.message,
        code: this.getErrorCode(error),
      };
    }
  }

  /**
   * Get standardized error code from database error
   */
  private getErrorCode(error: any): string {
    if (error.code) {
      switch (error.code) {
        case '23505': // unique_violation
          return 'DUPLICATE_ENTRY';
        case '23503': // foreign_key_violation
          return 'FOREIGN_KEY_VIOLATION';
        case '23502': // not_null_violation
          return 'NOT_NULL_VIOLATION';
        case '23514': // check_violation
          return 'CHECK_VIOLATION';
        case '08003': // connection_does_not_exist
        case '08006': // connection_failure
          return 'CONNECTION_ERROR';
        case '53300': // too_many_connections
          return 'TOO_MANY_CONNECTIONS';
        default:
          return `DB_ERROR_${error.code}`;
      }
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Execute operations within a transaction
   */
  async executeInTransaction<T>(
    callback: TransactionCallback<T>,
    operationName: string = 'transaction',
  ): Promise<DatabaseOperationResult<T>> {
    return this.executeWithErrorHandling(async () => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const result = await callback(queryRunner);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }, operationName);
  }

  // Session Operations
  async createSession(sessionData: Partial<Session>): Promise<DatabaseOperationResult<Session>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.create(sessionData),
      'createSession',
      { userId: sessionData.userId },
    );
  }

  async findSessionById(id: string): Promise<DatabaseOperationResult<Session | null>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.findById(id),
      'findSessionById',
      { sessionId: id },
    );
  }

  async findSessionsByUserId(userId: string): Promise<DatabaseOperationResult<Session[]>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.findByUserId(userId),
      'findSessionsByUserId',
      { userId },
    );
  }

  async findSessionByAccessToken(accessToken: string): Promise<DatabaseOperationResult<Session | null>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.findByAccessToken(accessToken),
      'findSessionByAccessToken',
    );
  }

  async findSessionByRefreshToken(refreshToken: string): Promise<DatabaseOperationResult<Session | null>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.findByRefreshToken(refreshToken),
      'findSessionByRefreshToken',
    );
  }

  async updateSessionLastAccessed(id: string): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.updateLastAccessed(id),
      'updateSessionLastAccessed',
      { sessionId: id },
    );
  }

  async deactivateSession(id: string): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.deactivateSession(id),
      'deactivateSession',
      { sessionId: id },
    );
  }

  async deactivateAllUserSessions(userId: string): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.deactivateAllUserSessions(userId),
      'deactivateAllUserSessions',
      { userId },
    );
  }

  async cleanupExpiredSessions(): Promise<DatabaseOperationResult<number>> {
    return this.executeWithErrorHandling(
      () => this.sessionRepository.cleanupExpiredSessions(),
      'cleanupExpiredSessions',
    );
  }

  // Login Attempt Operations
  async createLoginAttempt(attemptData: Partial<LoginAttempt>): Promise<DatabaseOperationResult<LoginAttempt>> {
    return this.executeWithErrorHandling(
      () => this.loginAttemptRepository.create(attemptData),
      'createLoginAttempt',
      { email: attemptData.email, successful: attemptData.successful },
    );
  }

  async findRecentLoginAttemptsByEmail(
    email: string,
    minutesBack: number = 15,
  ): Promise<DatabaseOperationResult<LoginAttempt[]>> {
    return this.executeWithErrorHandling(
      () => this.loginAttemptRepository.findRecentAttemptsByEmail(email, minutesBack),
      'findRecentLoginAttemptsByEmail',
      { email, minutesBack },
    );
  }

  async findRecentLoginAttemptsByIp(
    ipAddress: string,
    minutesBack: number = 15,
  ): Promise<DatabaseOperationResult<LoginAttempt[]>> {
    return this.executeWithErrorHandling(
      () => this.loginAttemptRepository.findRecentAttemptsByIp(ipAddress, minutesBack),
      'findRecentLoginAttemptsByIp',
      { ipAddress, minutesBack },
    );
  }

  async countFailedLoginAttemptsByEmail(
    email: string,
    minutesBack: number = 15,
  ): Promise<DatabaseOperationResult<number>> {
    return this.executeWithErrorHandling(
      () => this.loginAttemptRepository.countFailedAttemptsByEmail(email, minutesBack),
      'countFailedLoginAttemptsByEmail',
      { email, minutesBack },
    );
  }

  async countFailedLoginAttemptsByIp(
    ipAddress: string,
    minutesBack: number = 15,
  ): Promise<DatabaseOperationResult<number>> {
    return this.executeWithErrorHandling(
      () => this.loginAttemptRepository.countFailedAttemptsByIp(ipAddress, minutesBack),
      'countFailedLoginAttemptsByIp',
      { ipAddress, minutesBack },
    );
  }

  // Token Blacklist Operations
  async blacklistToken(
    tokenHash: string,
    userId: string,
    reason: TokenBlacklist['reason'],
    expiresAt: Date,
    metadata?: Record<string, any>,
  ): Promise<DatabaseOperationResult<TokenBlacklist>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.blacklistToken(tokenHash, userId, reason, expiresAt, metadata),
      'blacklistToken',
      { userId, reason },
    );
  }

  async isTokenBlacklisted(tokenHash: string): Promise<DatabaseOperationResult<boolean>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.isTokenBlacklisted(tokenHash),
      'isTokenBlacklisted',
    );
  }

  async blacklistAllUserTokens(
    userId: string,
    reason: TokenBlacklist['reason'] = 'security',
    metadata?: Record<string, any>,
  ): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.blacklistAllUserTokens(userId, reason, metadata),
      'blacklistAllUserTokens',
      { userId, reason },
    );
  }

  async findBlacklistedTokensByUserId(userId: string): Promise<DatabaseOperationResult<TokenBlacklist[]>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.findByUserId(userId),
      'findBlacklistedTokensByUserId',
      { userId },
    );
  }

  async cleanupExpiredTokens(): Promise<DatabaseOperationResult<number>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.cleanupExpiredTokens(),
      'cleanupExpiredTokens',
    );
  }

  async removeTokenFromBlacklist(tokenHash: string): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.removeFromBlacklist(tokenHash),
      'removeTokenFromBlacklist',
      { tokenHash },
    );
  }

  async findAllBlacklistedTokens(): Promise<DatabaseOperationResult<TokenBlacklist[]>> {
    return this.executeWithErrorHandling(
      () => this.tokenBlacklistRepository.findAllActive(),
      'findAllBlacklistedTokens',
    );
  }

  // Security Event Operations
  async createSecurityEvent(eventData: Partial<SecurityEvent>): Promise<DatabaseOperationResult<SecurityEvent>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.create(eventData),
      'createSecurityEvent',
      { userId: eventData.userId, type: eventData.type },
    );
  }

  async logSecurityEvent(
    userId: string,
    type: SecurityEvent['type'],
    ipAddress: string,
    userAgent?: string,
    metadata?: Record<string, any>,
    severity?: SecurityEvent['severity'],
  ): Promise<DatabaseOperationResult<SecurityEvent>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.logSecurityEvent(userId, type, ipAddress, userAgent, metadata, severity),
      'logSecurityEvent',
      { userId, type, severity },
    );
  }

  async findSecurityEventsByUserId(userId: string, limit: number = 50): Promise<DatabaseOperationResult<SecurityEvent[]>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.findByUserId(userId, limit),
      'findSecurityEventsByUserId',
      { userId, limit },
    );
  }

  async findUnprocessedSecurityEvents(): Promise<DatabaseOperationResult<SecurityEvent[]>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.findUnprocessedEvents(),
      'findUnprocessedSecurityEvents',
    );
  }

  async markSecurityEventAsProcessed(id: string): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.markAsProcessed(id),
      'markSecurityEventAsProcessed',
      { eventId: id },
    );
  }

  async markMultipleSecurityEventsAsProcessed(ids: string[]): Promise<DatabaseOperationResult<void>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.markMultipleAsProcessed(ids),
      'markMultipleSecurityEventsAsProcessed',
      { eventCount: ids.length },
    );
  }

  async countSecurityEventsByUserAndType(
    userId: string,
    type: SecurityEvent['type'],
    hoursBack: number = 24,
  ): Promise<DatabaseOperationResult<number>> {
    return this.executeWithErrorHandling(
      () => this.securityEventRepository.countEventsByUserAndType(userId, type, hoursBack),
      'countSecurityEventsByUserAndType',
      { userId, type, hoursBack },
    );
  }

  // Batch Operations
  async performMaintenanceTasks(): Promise<DatabaseOperationResult<{
    expiredSessions: number;
    expiredTokens: number;
    processedEvents: number;
  }>> {
    return this.executeInTransaction(async (queryRunner) => {
      const [expiredSessions, expiredTokens] = await Promise.all([
        this.sessionRepository.cleanupExpiredSessions(),
        this.tokenBlacklistRepository.cleanupExpiredTokens(),
      ]);

      // Process unprocessed security events (mark them for processing)
      const unprocessedEvents = await this.securityEventRepository.findUnprocessedEvents();
      const eventIds = unprocessedEvents.slice(0, 50).map(event => event.id); // Process in batches
      
      if (eventIds.length > 0) {
        await this.securityEventRepository.markMultipleAsProcessed(eventIds);
      }

      return {
        expiredSessions,
        expiredTokens,
        processedEvents: eventIds.length,
      };
    }, 'performMaintenanceTasks');
  }

  /**
   * Get database statistics for monitoring
   */
  async getDatabaseStatistics(): Promise<DatabaseOperationResult<{
    activeSessions: number;
    totalLoginAttempts24h: number;
    failedLoginAttempts24h: number;
    blacklistedTokens: number;
    unprocessedSecurityEvents: number;
  }>> {
    return this.executeWithErrorHandling(async () => {
      const [
        activeSessionsResult,
        totalAttemptsResult,
        failedAttemptsResult,
        blacklistedTokensResult,
        unprocessedEventsResult,
      ] = await Promise.all([
        this.dataSource.query('SELECT COUNT(*) as count FROM sessions WHERE is_active = true'),
        this.dataSource.query(`
          SELECT COUNT(*) as count FROM login_attempts 
          WHERE attempted_at > NOW() - INTERVAL '24 hours'
        `),
        this.dataSource.query(`
          SELECT COUNT(*) as count FROM login_attempts 
          WHERE attempted_at > NOW() - INTERVAL '24 hours' AND successful = false
        `),
        this.dataSource.query('SELECT COUNT(*) as count FROM token_blacklist WHERE expires_at > NOW()'),
        this.dataSource.query('SELECT COUNT(*) as count FROM security_events WHERE processed = false'),
      ]);

      return {
        activeSessions: parseInt(activeSessionsResult[0]?.count || '0'),
        totalLoginAttempts24h: parseInt(totalAttemptsResult[0]?.count || '0'),
        failedLoginAttempts24h: parseInt(failedAttemptsResult[0]?.count || '0'),
        blacklistedTokens: parseInt(blacklistedTokensResult[0]?.count || '0'),
        unprocessedSecurityEvents: parseInt(unprocessedEventsResult[0]?.count || '0'),
      };
    }, 'getDatabaseStatistics');
  }
}