export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  totalOperations: number;
  averageLatency: number;
}

export interface CacheMetricsData {
  userCacheHits: number;
  userCacheMisses: number;
  profileCacheHits: number;
  profileCacheMisses: number;
  batchOperations: number;
  averageLatency: number;
  lastResetTime: Date;
}

export interface CacheConfiguration {
  userTtl: number;
  profileTtl: number;
  batchTtl: number;
  maxBatchSize: number;
  enableMetrics: boolean;
}

export interface BatchCacheResult<T> {
  cached: Map<string, T>;
  missing: string[];
  hitRatio: number;
}

export interface CacheOperation {
  type: 'GET' | 'SET' | 'DELETE' | 'BATCH_GET' | 'BATCH_SET';
  key: string;
  success: boolean;
  latency: number;
  timestamp: Date;
}

// Import profile interfaces from user module
import { UserPreferences, PrivacySettings } from '../../../user/interfaces';

// Re-export for convenience
export { UserPreferences, PrivacySettings };

export interface Profile {
  userId: string;
  avatarUrl?: string;
  preferences?: UserPreferences;
  privacySettings?: PrivacySettings;
  metadata?: Record<string, any>;
  lastUpdated: Date;
}
