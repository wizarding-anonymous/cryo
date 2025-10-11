import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '../repositories/session.repository';
import { Session } from '../entities/session.entity';
import { RedisLockService } from '../common/redis/redis-lock.service';
import { RaceConditionMetricsService } from '../common/metrics/race-condition-metrics.service';

export interface CreateSessionDto {
  userId: string;
  accessToken: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

export interface SessionMetadata {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt?: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly redisLockService: RedisLockService,
    private readonly metricsService: RaceConditionMetricsService,
  ) {}

  /**
   * Create a new session with metadata tracking
   * Requirements: 13.1, 13.2
   */
  async createSession(sessionData: CreateSessionDto): Promise<Session> {
    this.logger.log(`Creating session for user ${sessionData.userId}`);

    const session = await this.sessionRepository.create({
      userId: sessionData.userId,
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      expiresAt: sessionData.expiresAt,
      isActive: true,
      lastAccessedAt: new Date(),
    });

    this.logger.log(`Session created with ID: ${session.id}`);
    return session;
  }

  /**
   * Retrieve session data and update last accessed timestamp
   * Requirements: 13.7
   */
  async getSession(sessionId: string): Promise<SessionMetadata | null> {
    this.logger.debug(`Retrieving session: ${sessionId}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      this.logger.debug(`Session not found: ${sessionId}`);
      return null;
    }

    // Update last accessed timestamp when session data is accessed
    await this.sessionRepository.updateLastAccessed(sessionId);

    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: new Date(), // Updated timestamp
    };
  }

  /**
   * Get session by access token and update last accessed timestamp
   * Requirements: 13.7
   */
  async getSessionByAccessToken(accessToken: string): Promise<SessionMetadata | null> {
    this.logger.debug('Retrieving session by access token');

    const session = await this.sessionRepository.findByAccessToken(accessToken);
    if (!session) {
      this.logger.debug('Session not found for access token');
      return null;
    }

    // Update last accessed timestamp
    await this.sessionRepository.updateLastAccessed(session.id);

    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: new Date(),
    };
  }

  /**
   * Get session by refresh token and update last accessed timestamp
   * Requirements: 13.7
   */
  async getSessionByRefreshToken(refreshToken: string): Promise<SessionMetadata | null> {
    this.logger.debug('Retrieving session by refresh token');

    const session = await this.sessionRepository.findByRefreshToken(refreshToken);
    if (!session) {
      this.logger.debug('Session not found for refresh token');
      return null;
    }

    // Update last accessed timestamp
    await this.sessionRepository.updateLastAccessed(session.id);

    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: new Date(),
    };
  }

  /**
   * Validate session and check if it's active and not expired
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return false;
    }

    // Check if session is active and not expired
    const isValid = session.isActive && session.expiresAt > new Date();
    
    if (isValid) {
      // Update last accessed timestamp for valid sessions
      await this.sessionRepository.updateLastAccessed(sessionId);
    }

    return isValid;
  }

  /**
   * Mark session as invalid
   * Requirements: 13.5
   */
  async invalidateSession(sessionId: string): Promise<void> {
    this.logger.log(`Invalidating session: ${sessionId}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.sessionRepository.deactivateSession(sessionId);
    this.logger.log(`Session invalidated: ${sessionId}`);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionMetadata[]> {
    this.logger.debug(`Retrieving sessions for user: ${userId}`);

    const sessions = await this.sessionRepository.findByUserId(userId);
    
    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: session.lastAccessedAt,
    }));
  }

  /**
   * Invalidate all sessions for a user (for security events)
   * Requirements: 13.6
   */
  async invalidateAllUserSessions(userId: string, reason: string = 'security_event'): Promise<number> {
    this.logger.log(`Invalidating all sessions for user: ${userId}, reason: ${reason}`);

    const userSessions = await this.sessionRepository.findByUserId(userId);
    const sessionCount = userSessions?.length || 0;

    await this.sessionRepository.deactivateAllUserSessions(userId);
    this.logger.log(`All ${sessionCount} sessions invalidated for user: ${userId}, reason: ${reason}`);
    
    return sessionCount;
  }

  /**
   * Invalidate sessions for security events with detailed logging
   * Requirements: 13.5, 13.6
   */
  async invalidateSessionsForSecurityEvent(
    userId: string, 
    securityEventType: 'password_change' | 'suspicious_activity' | 'account_compromise' | 'admin_action',
    excludeSessionId?: string
  ): Promise<{
    invalidatedCount: number;
    remainingCount: number;
    securityEventType: string;
  }> {
    this.logger.warn(`Security event triggered session invalidation for user: ${userId}, event: ${securityEventType}`);

    const userSessions = await this.sessionRepository.findByUserId(userId);
    let invalidatedCount = 0;

    if (excludeSessionId) {
      // Invalidate all sessions except the specified one (e.g., current session during password change)
      const sessionsToInvalidate = userSessions.filter(session => session.id !== excludeSessionId);
      
      for (const session of sessionsToInvalidate) {
        await this.sessionRepository.deactivateSession(session.id);
        invalidatedCount++;
        this.logger.log(`Invalidated session: ${session.id} for security event: ${securityEventType}`);
      }
    } else {
      // Invalidate all sessions
      await this.sessionRepository.deactivateAllUserSessions(userId);
      invalidatedCount = userSessions.length;
    }

    const remainingCount = excludeSessionId ? 1 : 0;

    this.logger.warn(`Security event session invalidation completed: ${invalidatedCount} sessions invalidated, ${remainingCount} remaining`);

    return {
      invalidatedCount,
      remainingCount,
      securityEventType,
    };
  }

  /**
   * Limit maximum concurrent sessions per user
   * Requirements: 13.3
   */
  async enforceSessionLimit(userId: string, maxSessions: number = 5): Promise<number> {
    this.logger.debug(`Enforcing session limit for user: ${userId}, max: ${maxSessions}`);

    const sessions = await this.sessionRepository.findByUserId(userId);
    
    if (sessions.length >= maxSessions) {
      // Sort by last accessed time (oldest first), then by creation date
      const sortedSessions = sessions.sort((a, b) => {
        // If lastAccessedAt is null, use createdAt
        const aTime = a.lastAccessedAt?.getTime() || a.createdAt.getTime();
        const bTime = b.lastAccessedAt?.getTime() || b.createdAt.getTime();
        return aTime - bTime;
      });
      
      const sessionsToDeactivate = sortedSessions.slice(0, sessions.length - maxSessions + 1);
      
      for (const session of sessionsToDeactivate) {
        await this.sessionRepository.deactivateSession(session.id);
        this.logger.log(`Deactivated old session: ${session.id} for user: ${userId} (last accessed: ${session.lastAccessedAt || 'never'})`);
      }
      
      return sessionsToDeactivate.length;
    }
    
    return 0;
  }

  /**
   * Atomically enforce session limit and create new session using distributed lock
   * This prevents race conditions when multiple concurrent logins occur
   * Requirements: 13.3 - Concurrent session limiting with race condition protection
   */
  async createSessionWithLimit(
    sessionData: CreateSessionDto,
    maxSessions: number = 5
  ): Promise<{ session: Session; removedSessionsCount: number }> {
    const lockKey = `session_limit:${sessionData.userId}`;
    
    // Record concurrent session creation attempt
    this.metricsService.recordConcurrentSessionCreation();
    
    return await this.redisLockService.withLock(
      lockKey,
      async () => {
        this.logger.debug(`Atomically creating session with limit for user: ${sessionData.userId}`);
        
        // First, enforce session limit
        const removedSessionsCount = await this.enforceSessionLimit(sessionData.userId, maxSessions);
        
        // Then create the new session
        const session = await this.createSession(sessionData);
        
        this.logger.debug(`Session created atomically for user: ${sessionData.userId}, removed ${removedSessionsCount} old sessions`);
        
        return { session, removedSessionsCount };
      },
      {
        ttlSeconds: 5, // 5 second TTL as specified in the task
        retryDelayMs: 50, // Shorter retry delay for better UX
        maxRetries: 3 // Allow a few retries for concurrent requests
      }
    );
  }

  /**
   * Atomically enforce session limit and create new session using distributed lock
   * This prevents race conditions when multiple concurrent logins occur
   * Requirements: 13.3 - Concurrent session limiting with race condition protection
   */
  async enforceSessionLimitAndCreateSession(
    sessionData: CreateSessionDto,
    maxSessions: number = 5
  ): Promise<{ session: Session; removedSessionsCount: number }> {
    const lockKey = `session_limit:${sessionData.userId}`;
    
    return await this.redisLockService.withLock(
      lockKey,
      async () => {
        this.logger.debug(`Atomically enforcing session limit and creating session for user: ${sessionData.userId}`);
        
        // Step 1: Enforce session limit within the lock
        const removedSessionsCount = await this.enforceSessionLimit(sessionData.userId, maxSessions);
        
        // Step 2: Create new session within the same lock
        const session = await this.createSession(sessionData);
        
        this.logger.debug(`Session created atomically for user: ${sessionData.userId}, removed ${removedSessionsCount} old sessions`);
        
        return { session, removedSessionsCount };
      },
      {
        ttlSeconds: 5, // 5 second TTL as specified in the task
        retryDelayMs: 50,
        maxRetries: 3
      }
    );
  }

  /**
   * Cleanup expired sessions automatically
   * Requirements: 13.4
   * Runs every hour to clean up expired sessions
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting cleanup of expired sessions');

    try {
      const deletedCount = await this.sessionRepository.cleanupExpiredSessions();
      this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
    }
  }

  /**
   * Cleanup stale sessions automatically
   * Requirements: 13.4, 13.7
   * Runs every 6 hours to clean up sessions that haven't been accessed recently
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async cleanupStaleSessionsScheduled(): Promise<void> {
    this.logger.log('Starting cleanup of stale sessions');

    try {
      const cleanedCount = await this.cleanupStaleSessions(72); // 72 hours = 3 days
      this.logger.log(`Cleaned up ${cleanedCount} stale sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup stale sessions', error);
    }
  }

  /**
   * Manual cleanup method for maintenance tasks
   * Requirements: 13.4
   */
  async performSessionCleanup(): Promise<number> {
    this.logger.log('Performing manual session cleanup');

    try {
      const deletedCount = await this.sessionRepository.cleanupExpiredSessions();
      this.logger.log(`Manual cleanup completed: ${deletedCount} sessions removed`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Manual session cleanup failed', error);
      throw error;
    }
  }

  /**
   * Get session statistics for monitoring
   * Requirements: 13.2, 13.4, 13.7
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    totalExpiredSessions: number;
    sessionsPerUser: Record<string, number>;
  }> {
    this.logger.debug('Retrieving session statistics');
    
    try {
      const stats = await this.sessionRepository.getSessionStats();
      this.logger.debug(`Session stats: ${stats.totalActiveSessions} active, ${stats.totalExpiredSessions} expired`);
      return stats;
    } catch (error) {
      this.logger.error('Failed to retrieve session statistics', error);
      throw error;
    }
  }

  /**
   * Get concurrent session information for a specific user
   * Requirements: 13.3
   */
  async getConcurrentSessionInfo(userId: string, maxSessions: number = 5): Promise<{
    currentSessionCount: number;
    maxAllowedSessions: number;
    isAtLimit: boolean;
    canCreateNewSession: boolean;
    oldestSessionAge: number | null;
    sessionsUntilLimit: number;
  }> {
    this.logger.debug(`Getting concurrent session info for user: ${userId}`);

    const currentSessionCount = await this.sessionRepository.countActiveSessionsByUserId(userId);
    const isAtLimit = currentSessionCount >= maxSessions;
    const canCreateNewSession = currentSessionCount < maxSessions;
    const sessionsUntilLimit = Math.max(0, maxSessions - currentSessionCount);

    let oldestSessionAge: number | null = null;
    if (currentSessionCount > 0) {
      const sessions = await this.sessionRepository.findByUserId(userId);
      if (sessions.length > 0) {
        const oldestSession = sessions.reduce((oldest, current) => {
          const oldestTime = oldest.lastAccessedAt?.getTime() || oldest.createdAt.getTime();
          const currentTime = current.lastAccessedAt?.getTime() || current.createdAt.getTime();
          return currentTime < oldestTime ? current : oldest;
        });
        
        const oldestTime = oldestSession.lastAccessedAt?.getTime() || oldestSession.createdAt.getTime();
        oldestSessionAge = Date.now() - oldestTime;
      }
    }

    return {
      currentSessionCount,
      maxAllowedSessions: maxSessions,
      isAtLimit,
      canCreateNewSession,
      oldestSessionAge,
      sessionsUntilLimit,
    };
  }

  /**
   * Find sessions by IP address for security monitoring
   * Requirements: 13.2
   */
  async getSessionsByIpAddress(ipAddress: string): Promise<SessionMetadata[]> {
    this.logger.debug(`Retrieving sessions for IP address: ${ipAddress}`);

    const sessions = await this.sessionRepository.findSessionsByIpAddress(ipAddress);
    
    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: session.lastAccessedAt,
    }));
  }

  /**
   * Find and optionally cleanup stale sessions
   * Requirements: 13.7
   */
  async findStaleSessionsOlderThan(hours: number = 24): Promise<SessionMetadata[]> {
    this.logger.debug(`Finding stale sessions older than ${hours} hours`);

    const staleSessions = await this.sessionRepository.findStaleSessionsOlderThan(hours);
    
    return staleSessions.map(session => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: session.lastAccessedAt,
    }));
  }

  /**
   * Update session metadata when client information changes
   * Requirements: 13.2, 13.7
   */
  async updateSessionMetadata(sessionId: string, ipAddress: string, userAgent: string): Promise<void> {
    this.logger.debug(`Updating metadata for session: ${sessionId}`);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    await this.sessionRepository.updateSessionMetadata(sessionId, ipAddress, userAgent);
    this.logger.log(`Session metadata updated: ${sessionId}`);
  }

  /**
   * Cleanup stale sessions that haven't been accessed recently
   * Requirements: 13.4, 13.7
   */
  async cleanupStaleSessions(maxIdleHours: number = 72): Promise<number> {
    this.logger.log(`Cleaning up sessions idle for more than ${maxIdleHours} hours`);

    try {
      const staleSessions = await this.sessionRepository.findStaleSessionsOlderThan(maxIdleHours);
      
      let cleanedCount = 0;
      for (const session of staleSessions) {
        await this.sessionRepository.deactivateSession(session.id);
        cleanedCount++;
      }

      this.logger.log(`Cleaned up ${cleanedCount} stale sessions`);
      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup stale sessions', error);
      throw error;
    }
  }
}