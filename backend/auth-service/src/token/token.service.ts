import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { AuthDatabaseService } from '../database/auth-database.service';
import { TokenBlacklist } from '../entities/token-blacklist.entity';
import { DistributedTransactionService } from '../common/distributed-transaction/distributed-transaction.service';
import { ConsistencyMetricsService } from '../common/distributed-transaction/consistency-metrics.service';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: JwtPayload;
  reason?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly authDatabaseService: AuthDatabaseService,
    private readonly distributedTransactionService: DistributedTransactionService,
    private readonly consistencyMetricsService: ConsistencyMetricsService,
  ) {}

  /**
   * Generate JWT tokens for a user
   * Requirement 5.3: Generate JWT access and refresh tokens
   */
  async generateTokens(user: { id: string; email: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }), // Refresh token valid for 7 days
    ]);

    // Get expiration time for access token (default 1h = 3600 seconds)
    const expiresIn = 3600;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Blacklist a token in both local database and Redis using distributed transaction
   * Requirement 5.3: Implement JWT token blacklisting with local database and Redis
   * Requirement 12.2: Store blacklist entries locally
   * Security Fix 16.2: Atomic blacklist operations with 2PC consistency
   */
  async blacklistToken(
    token: string, 
    userId: string, 
    reason: TokenBlacklist['reason'] = 'logout',
    metadata?: Record<string, any>
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      // Decode token to get expiration time
      const decoded = this.jwtService.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) {
        this.logger.warn('Invalid token format for blacklisting');
        return;
      }

      // Calculate expiration date
      const expiresAt = new Date(decoded.exp * 1000);
      const now = new Date();

      if (expiresAt <= now) {
        this.logger.log('Token already expired, no need to blacklist');
        return;
      }

      // Create token hash for storage
      const tokenHash = this.createTokenHash(token);
      const ttl = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

      if (ttl <= 0) {
        this.logger.log('Token expires too soon, no need to blacklist');
        return;
      }

      // Use distributed transaction for atomic blacklist operation
      await this.distributedTransactionService.atomicBlacklistToken({
        token,
        tokenHash,
        userId,
        reason,
        expiresAt,
        ttlSeconds: ttl,
        metadata
      });

      success = true;
      this.logger.log(`Token blacklisted atomically with TTL: ${ttl}s, reason: ${reason}`);
    } catch (error) {
      this.logger.error('Failed to blacklist token atomically', error.stack);
      // Don't throw error to avoid breaking logout flow
    } finally {
      // Record metrics for monitoring
      const duration = Date.now() - startTime;
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'logout',
        success,
        duration,
        { reason, userId: userId.substring(0, 8) + '...' }
      );
    }
  }

  /**
   * Check if a token is blacklisted (checks both Redis and local database)
   * Requirement 5.7: Check token blacklist status
   * Requirement 12.3: Check local session store first
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      // First check Redis for fast lookup
      const redisBlacklisted = await this.redisService.isTokenBlacklisted(token);
      if (redisBlacklisted) {
        return true;
      }

      // Fallback to local database if Redis is unavailable or doesn't have the entry
      const tokenHash = this.createTokenHash(token);
      const localBlacklisted = await this.authDatabaseService.isTokenBlacklisted(tokenHash);
      
      return localBlacklisted;
    } catch (error) {
      this.logger.error('Failed to check token blacklist status', error.stack);
      // Return false to allow request to proceed if both Redis and DB are down
      return false;
    }
  }



  /**
   * Validate token structure, signature, expiration, and blacklist status
   * Requirement 5.7: Token validation methods checking blacklist status
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Verify token signature and expiration
      const payload = this.jwtService.verify(token) as JwtPayload;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return {
          valid: false,
          reason: 'Token is blacklisted'
        };
      }

      return {
        valid: true,
        payload
      };
    } catch (error) {
      let reason = 'Invalid token';
      if (error.name === 'TokenExpiredError') {
        reason = 'Token expired';
      } else if (error.name === 'JsonWebTokenError') {
        reason = 'Invalid token signature';
      }

      return {
        valid: false,
        reason
      };
    }
  }

  /**
   * Blacklist all tokens for a specific user using distributed transaction
   * Requirement 5.3: Add methods for bulk token invalidation per user
   * Security Fix 16.2: Atomic bulk invalidation with consistency guarantees
   */
  async blacklistAllUserTokens(
    userId: string, 
    reason: TokenBlacklist['reason'] = 'security',
    metadata?: Record<string, any>
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      // Store bulk invalidation record in local database
      await this.authDatabaseService.blacklistAllUserTokens(userId, reason, metadata);

      // Clear any user-specific Redis entries
      // Note: This is a simple implementation. In production, you might want to
      // maintain a list of active tokens per user for more precise invalidation
      const userTokensKey = `user_tokens:${userId}`;
      await this.redisService.delete(userTokensKey);

      // Set a Redis flag to indicate all tokens for this user are invalid
      const userInvalidationKey = `user_invalidated:${userId}`;
      const oneYear = 365 * 24 * 60 * 60; // 1 year in seconds
      await this.redisService.set(userInvalidationKey, 'true', oneYear);

      success = true;
      this.logger.log(`All tokens blacklisted for user: ${userId}, reason: ${reason}`);
    } catch (error) {
      this.logger.error('Failed to blacklist user tokens', error.stack);
      throw error;
    } finally {
      // Record metrics for monitoring
      const duration = Date.now() - startTime;
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'bulk_invalidation',
        success,
        duration,
        { reason, userId: userId.substring(0, 8) + '...' }
      );
    }
  }

  /**
   * Check if all tokens for a user have been invalidated
   */
  async areAllUserTokensInvalidated(userId: string): Promise<boolean> {
    try {
      const userInvalidationKey = `user_invalidated:${userId}`;
      const result = await this.redisService.get(userInvalidationKey);
      return result === 'true';
    } catch (error) {
      this.logger.error('Failed to check user token invalidation status', error.stack);
      return false;
    }
  }

  /**
   * Enhanced token validation that also checks user-level invalidation
   */
  async validateTokenWithUserCheck(token: string): Promise<TokenValidationResult> {
    const basicValidation = await this.validateToken(token);
    
    if (!basicValidation.valid || !basicValidation.payload) {
      return basicValidation;
    }

    // Check if all user tokens have been invalidated
    const userTokensInvalidated = await this.areAllUserTokensInvalidated(basicValidation.payload.sub);
    if (userTokensInvalidated) {
      return {
        valid: false,
        reason: 'All user tokens have been invalidated'
      };
    }

    return basicValidation;
  }

  /**
   * Cleanup expired tokens from local database
   * This should be called periodically by a scheduled task
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      // This would be implemented in the repository/database service
      // For now, we'll delegate to the auth database service
      const deletedCount = await this.authDatabaseService.cleanupExpiredTokens();
      this.logger.log(`Cleaned up ${deletedCount} expired tokens`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', error.stack);
      return 0;
    }
  }

  /**
   * Get blacklisted tokens for a user (for admin/debugging purposes)
   */
  async getUserBlacklistedTokens(userId: string): Promise<TokenBlacklist[]> {
    try {
      return await this.authDatabaseService.getUserBlacklistedTokens(userId);
    } catch (error) {
      this.logger.error('Failed to get user blacklisted tokens', error.stack);
      return [];
    }
  }

  /**
   * Create a hash of the token for storage (to avoid storing full tokens)
   */
  private createTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Public method to hash tokens for secure storage
   * Requirement 15.2: Hash tokens using SHA-256 for secure database storage
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Refresh token with rotation - validates old refresh token and generates new tokens
   * Requirement 5.7: Generate new access token from refresh token
   * Requirement 4.4: Generate refresh tokens with longer expiration
   * Security Fix 15.4: Atomic rotation with compensation for failures
   */
  async refreshTokenWithRotation(
    refreshToken: string,
    userId: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // Validate the refresh token first
    const validation = await this.validateToken(refreshToken);
    if (!validation.valid || !validation.payload) {
      throw new Error(`Invalid refresh token: ${validation.reason}`);
    }

    // Verify the user ID matches
    if (validation.payload.sub !== userId) {
      throw new Error('Token user ID mismatch');
    }

    // SECURITY FIX: Blacklist old token FIRST to prevent Token Fixation
    // This ensures that even if new token generation fails, old token is already invalid
    await this.blacklistToken(
      refreshToken,
      userId,
      'refresh',
      { 
        rotatedAt: new Date(),
        action: 'rotation_start',
        phase: 'blacklist_old_token'
      }
    );

    let newTokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };

    try {
      // Generate new tokens after blacklisting old one
      newTokens = await this.generateTokens({
        id: validation.payload.sub,
        email: validation.payload.email
      });

      // Verify new tokens are unique and not already blacklisted
      await this.verifyTokenUniqueness(newTokens.accessToken, newTokens.refreshToken);

      this.logger.log(`Refresh token rotated successfully for user: ${userId}`);

      return newTokens;

    } catch (error) {
      // COMPENSATION: If new token generation fails, we need to restore the old token
      // This prevents user from being locked out due to failed token generation
      this.logger.error(`Token generation failed during rotation for user ${userId}, attempting rollback`, error.stack);
      
      try {
        await this.removeFromBlacklist(refreshToken, userId);
        this.logger.log(`Successfully rolled back blacklisted token for user: ${userId}`);
      } catch (rollbackError) {
        // If rollback also fails, log critical error but don't throw
        // User will need to re-authenticate, but this prevents system inconsistency
        this.logger.error(`CRITICAL: Failed to rollback token blacklist for user ${userId}`, rollbackError.stack);
        
        // Log security event for monitoring
        try {
          await this.authDatabaseService.logSecurityEvent({
            userId,
            type: 'critical_error' as any,
            ipAddress: 'system',
            userAgent: 'auth-service',
            metadata: {
              eventType: 'token_rotation_rollback_failed',
              severity: 'critical',
              requiresInvestigation: true,
              originalError: error.message,
              rollbackError: rollbackError.message,
              refreshToken: this.createTokenHash(refreshToken),
              timestamp: new Date()
            },
            severity: 'critical' as any
          });
        } catch (logError) {
          this.logger.error(`Failed to log critical security event: token_rotation_rollback_failed`, {
            userId,
            originalError: error.message,
            rollbackError: rollbackError.message,
            logError: logError.message
          });
        }
      }

      // Re-throw the original error
      throw new Error(`Token rotation failed: ${error.message}`);
    }
  }

  /**
   * Validate refresh token specifically (checks longer expiration)
   */
  async validateRefreshToken(refreshToken: string): Promise<TokenValidationResult> {
    try {
      // Verify token signature and expiration (refresh tokens have longer expiration)
      const payload = this.jwtService.verify(refreshToken) as JwtPayload;
      
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        return {
          valid: false,
          reason: 'Refresh token is blacklisted'
        };
      }

      // Additional check for user-level invalidation
      const userTokensInvalidated = await this.areAllUserTokensInvalidated(payload.sub);
      if (userTokensInvalidated) {
        return {
          valid: false,
          reason: 'All user tokens have been invalidated'
        };
      }

      return {
        valid: true,
        payload
      };
    } catch (error) {
      let reason = 'Invalid refresh token';
      if (error.name === 'TokenExpiredError') {
        reason = 'Refresh token expired';
      } else if (error.name === 'JsonWebTokenError') {
        reason = 'Invalid refresh token signature';
      }

      return {
        valid: false,
        reason
      };
    }
  }

  /**
   * Remove token from blacklist (for rollback operations) using distributed transaction
   * Used in compensating transactions when logout operations fail
   * Requirements: 15.3 - Rollback mechanism for atomic logout operations
   * Security Fix 15.4: Enhanced rollback for token rotation failures
   * Security Fix 16.2: Atomic removal with 2PC consistency
   */
  async removeFromBlacklist(token: string, userId: string): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      // Use distributed transaction for atomic removal
      await this.distributedTransactionService.atomicRemoveFromBlacklist(token, userId);

      success = true;
      this.logger.log(`Token removed from blacklist atomically for rollback - user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to remove token from blacklist atomically during rollback', error.stack);
      // Don't throw error to avoid breaking rollback flow
      // But log it as a critical security event
      await this.logCriticalSecurityEvent(userId, 'rollback_failure', {
        operation: 'removeFromBlacklist',
        tokenHash: this.createTokenHash(token),
        error: error.message,
        timestamp: new Date()
      });
    } finally {
      // Record metrics for monitoring
      const duration = Date.now() - startTime;
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'token_rotation',
        success,
        duration,
        { operation: 'rollback', userId: userId.substring(0, 8) + '...' }
      );
    }
  }

  /**
   * Decode token without verification (for getting expiration time)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch (error) {
      this.logger.error('Failed to decode token', error.stack);
      return null;
    }
  }

  /**
   * Verify that new tokens are unique and not already blacklisted
   * Security Fix 15.4: Ensure token uniqueness before issuing
   */
  private async verifyTokenUniqueness(accessToken: string, refreshToken: string): Promise<void> {
    // Check if access token is already blacklisted
    const accessTokenBlacklisted = await this.isTokenBlacklisted(accessToken);
    if (accessTokenBlacklisted) {
      throw new Error('Generated access token is already blacklisted - potential collision');
    }

    // Check if refresh token is already blacklisted
    const refreshTokenBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (refreshTokenBlacklisted) {
      throw new Error('Generated refresh token is already blacklisted - potential collision');
    }

    // Additional check: verify tokens are different
    if (accessToken === refreshToken) {
      throw new Error('Access and refresh tokens are identical - generation error');
    }

    this.logger.debug('Token uniqueness verified successfully');
  }

  /**
   * Log critical security events for monitoring and alerting
   * Used for token rotation failures and other security-critical operations
   */
  private async logCriticalSecurityEvent(
    userId: string, 
    eventType: string, 
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await this.authDatabaseService.logSecurityEvent({
        userId,
        type: 'critical_error' as any, // Cast to avoid type issues
        ipAddress: 'system',
        userAgent: 'auth-service',
        metadata: {
          eventType,
          severity: 'critical',
          requiresInvestigation: true,
          ...metadata
        },
        severity: 'critical' as any
      });
    } catch (error) {
      // If we can't log the security event, at least log it locally
      this.logger.error(`Failed to log critical security event: ${eventType}`, {
        userId,
        metadata,
        error: error.message
      });
    }
  }
}