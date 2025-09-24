import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  name: string; // logical name for the limiter key
  limit: number;
  window: number; // seconds
  keyBy?: 'ip' | 'user' | 'path';
}

export const RATE_LIMIT_META_KEY = 'rateLimitOptions';
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_META_KEY, options);
