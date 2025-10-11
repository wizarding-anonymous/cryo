import { Injectable, Logger } from '@nestjs/common';

export interface RaceConditionMetrics {
  totalLockAttempts: number;
  successfulLockAcquisitions: number;
  failedLockAcquisitions: number;
  lockConflicts: number;
  averageLockWaitTime: number;
  maxLockWaitTime: number;
  lockTimeouts: number;
  concurrentSessionCreations: number;
}

export interface LockAttemptResult {
  success: boolean;
  waitTimeMs: number;
  conflicted: boolean;
  timedOut: boolean;
}

@Injectable()
export class RaceConditionMetricsService {
  private readonly logger = new Logger(RaceConditionMetricsService.name);
  
  private metrics: RaceConditionMetrics = {
    totalLockAttempts: 0,
    successfulLockAcquisitions: 0,
    failedLockAcquisitions: 0,
    lockConflicts: 0,
    averageLockWaitTime: 0,
    maxLockWaitTime: 0,
    lockTimeouts: 0,
    concurrentSessionCreations: 0,
  };

  private waitTimes: number[] = [];
  private readonly maxWaitTimesSamples = 1000; // Keep last 1000 samples for average calculation

  /**
   * Record a lock attempt result
   * @param result - The result of the lock attempt
   */
  recordLockAttempt(result: LockAttemptResult): void {
    this.metrics.totalLockAttempts++;

    if (result.success) {
      this.metrics.successfulLockAcquisitions++;
    } else {
      this.metrics.failedLockAcquisitions++;
    }

    if (result.conflicted) {
      this.metrics.lockConflicts++;
    }

    if (result.timedOut) {
      this.metrics.lockTimeouts++;
    }

    // Update wait time metrics
    this.waitTimes.push(result.waitTimeMs);
    if (this.waitTimes.length > this.maxWaitTimesSamples) {
      this.waitTimes.shift(); // Remove oldest sample
    }

    this.metrics.averageLockWaitTime = this.calculateAverageWaitTime();
    this.metrics.maxLockWaitTime = Math.max(this.metrics.maxLockWaitTime, result.waitTimeMs);

    // Log significant events
    if (result.conflicted) {
      this.logger.warn(`Lock conflict detected - wait time: ${result.waitTimeMs}ms`);
    }

    if (result.timedOut) {
      this.logger.error(`Lock timeout occurred - wait time: ${result.waitTimeMs}ms`);
    }
  }

  /**
   * Record a concurrent session creation event
   */
  recordConcurrentSessionCreation(): void {
    this.metrics.concurrentSessionCreations++;
    this.logger.debug('Concurrent session creation detected');
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): RaceConditionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics in Prometheus format for monitoring
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    
    return [
      `# HELP auth_service_lock_attempts_total Total number of lock attempts`,
      `# TYPE auth_service_lock_attempts_total counter`,
      `auth_service_lock_attempts_total ${metrics.totalLockAttempts}`,
      ``,
      `# HELP auth_service_lock_acquisitions_successful_total Successful lock acquisitions`,
      `# TYPE auth_service_lock_acquisitions_successful_total counter`,
      `auth_service_lock_acquisitions_successful_total ${metrics.successfulLockAcquisitions}`,
      ``,
      `# HELP auth_service_lock_acquisitions_failed_total Failed lock acquisitions`,
      `# TYPE auth_service_lock_acquisitions_failed_total counter`,
      `auth_service_lock_acquisitions_failed_total ${metrics.failedLockAcquisitions}`,
      ``,
      `# HELP auth_service_lock_conflicts_total Number of lock conflicts (race conditions)`,
      `# TYPE auth_service_lock_conflicts_total counter`,
      `auth_service_lock_conflicts_total ${metrics.lockConflicts}`,
      ``,
      `# HELP auth_service_lock_wait_time_avg_ms Average lock wait time in milliseconds`,
      `# TYPE auth_service_lock_wait_time_avg_ms gauge`,
      `auth_service_lock_wait_time_avg_ms ${metrics.averageLockWaitTime}`,
      ``,
      `# HELP auth_service_lock_wait_time_max_ms Maximum lock wait time in milliseconds`,
      `# TYPE auth_service_lock_wait_time_max_ms gauge`,
      `auth_service_lock_wait_time_max_ms ${metrics.maxLockWaitTime}`,
      ``,
      `# HELP auth_service_lock_timeouts_total Number of lock timeouts`,
      `# TYPE auth_service_lock_timeouts_total counter`,
      `auth_service_lock_timeouts_total ${metrics.lockTimeouts}`,
      ``,
      `# HELP auth_service_concurrent_session_creations_total Concurrent session creation events`,
      `# TYPE auth_service_concurrent_session_creations_total counter`,
      `auth_service_concurrent_session_creations_total ${metrics.concurrentSessionCreations}`,
      ``,
    ].join('\n');
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalLockAttempts: 0,
      successfulLockAcquisitions: 0,
      failedLockAcquisitions: 0,
      lockConflicts: 0,
      averageLockWaitTime: 0,
      maxLockWaitTime: 0,
      lockTimeouts: 0,
      concurrentSessionCreations: 0,
    };
    this.waitTimes = [];
    this.logger.debug('Race condition metrics reset');
  }

  /**
   * Get lock success rate as percentage
   */
  getLockSuccessRate(): number {
    if (this.metrics.totalLockAttempts === 0) {
      return 100; // No attempts yet, consider it 100%
    }
    return (this.metrics.successfulLockAcquisitions / this.metrics.totalLockAttempts) * 100;
  }

  /**
   * Get lock conflict rate as percentage
   */
  getLockConflictRate(): number {
    if (this.metrics.totalLockAttempts === 0) {
      return 0; // No attempts yet
    }
    return (this.metrics.lockConflicts / this.metrics.totalLockAttempts) * 100;
  }

  /**
   * Check if metrics indicate potential issues
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const successRate = this.getLockSuccessRate();
    const conflictRate = this.getLockConflictRate();
    
    // Check success rate
    if (successRate < 95) {
      issues.push(`Low lock success rate: ${successRate.toFixed(2)}%`);
      recommendations.push('Consider increasing lock timeout or reducing concurrent load');
    }
    
    // Check conflict rate
    if (conflictRate > 10) {
      issues.push(`High lock conflict rate: ${conflictRate.toFixed(2)}%`);
      recommendations.push('High concurrency detected, consider load balancing or rate limiting');
    }
    
    // Check average wait time
    if (this.metrics.averageLockWaitTime > 1000) {
      issues.push(`High average lock wait time: ${this.metrics.averageLockWaitTime}ms`);
      recommendations.push('Consider optimizing lock duration or increasing Redis performance');
    }
    
    // Check timeout rate
    const timeoutRate = this.metrics.totalLockAttempts > 0 
      ? (this.metrics.lockTimeouts / this.metrics.totalLockAttempts) * 100 
      : 0;
    
    if (timeoutRate > 5) {
      issues.push(`High lock timeout rate: ${timeoutRate.toFixed(2)}%`);
      recommendations.push('Consider increasing lock timeout or improving Redis connectivity');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  private calculateAverageWaitTime(): number {
    if (this.waitTimes.length === 0) {
      return 0;
    }
    
    const sum = this.waitTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.waitTimes.length);
  }
}