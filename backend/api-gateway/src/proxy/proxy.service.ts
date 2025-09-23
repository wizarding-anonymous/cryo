import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { ServiceRegistryService } from '../registry/service-registry.service';
import { ServiceUnavailableException } from '../common/exceptions/service-unavailable.exception';
import { ProxyTimeoutException } from '../common/exceptions/proxy-timeout.exception';
import type { ServiceConfig } from '../config/service-config.interface';

type CircuitState = {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  firstFailureAt: number | null;
  openedAt: number | null;
};

@Injectable()
export class ProxyService {
  private readonly circuitStates = new Map<string, CircuitState>();

  constructor(private readonly registry: ServiceRegistryService) {}

  async forwardPlaceholder(req: Request): Promise<{ statusCode: number; headers: Record<string, string>; body: any }> {
    // Backward compatibility; not used after full forward implementation
    return this.forward(req);
  }

  async forward(req: Request): Promise<{ statusCode: number; headers: Record<string, string>; body: any }> {
    const { targetService, remainderPath } = this.resolveService(req.path);
    if (!targetService) {
      return {
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: { error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
      };
    }

    const config = this.registry.getServiceConfig(targetService);
    if (!config) {
      throw new ServiceUnavailableException(targetService, 'Service not configured');
    }

    if (!this.allowRequest(targetService, config)) {
      throw new ServiceUnavailableException(targetService, 'Circuit breaker is open');
    }

    const url = this.composeUrl(config.baseUrl, remainderPath, req.url);
    const headers = this.buildForwardHeaders(req.headers as Record<string, string | string[] | undefined>);

    const requestConfig: AxiosRequestConfig = {
      url,
      method: req.method as any,
      headers,
      data: req.body,
      timeout: config.timeout,
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 200 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 200 }),
      decompress: true,
      validateStatus: () => true,
    };

    const maxAttempts = Math.max(1, config.retries + 1);
    const start = Date.now();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios(requestConfig);
        // Success path: close breaker on success
        this.recordSuccess(targetService);
        const hdrs: Record<string, string> = {};
        Object.entries(resp.headers || {}).forEach(([k, v]) => {
          if (Array.isArray(v)) hdrs[k] = v.join(', ');
          else if (v !== undefined) hdrs[k] = String(v);
        });
        return {
          statusCode: resp.status,
          headers: hdrs,
          body: resp.data,
        } as any;
      } catch (e) {
        lastErr = e;
        const err = e as AxiosError;
        // Timeout
        if (err.code === 'ECONNABORTED') {
          this.recordFailure(targetService, config);
          throw new ProxyTimeoutException(targetService, config.timeout);
        }
        // Network or 5xx are retriable
        const status = err.response?.status;
        const retriable = !status || (status >= 500 && status < 600);
        if (!retriable || attempt === maxAttempts) {
          this.recordFailure(targetService, config);
          // If response exists, forward it
          if (err.response) {
            const hdrs: Record<string, string> = {};
            Object.entries(err.response.headers || {}).forEach(([k, v]) => {
              if (Array.isArray(v)) hdrs[k] = v.join(', ');
              else if (v !== undefined) hdrs[k] = String(v);
            });
            return {
              statusCode: status ?? 502,
              headers: hdrs,
              body: err.response.data ?? { error: 'BAD_GATEWAY', message: 'Upstream error' },
            } as any;
          }
          throw new ServiceUnavailableException(targetService, 'Upstream unavailable');
        }
        // exponential backoff: 100ms * 2^(attempt-1)
        const delay = 100 * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    // Fallback, though code should not reach here
    this.recordFailure(targetService, config);
    throw lastErr ?? new ServiceUnavailableException(targetService);
  }

  private resolveService(fullPath: string): { targetService?: string; remainderPath: string } {
    // Expecting paths like /api/<resource>/...
    const parts = fullPath.split('?')[0].split('/').filter(Boolean); // remove empty
    const idx = parts[0] === 'api' ? 1 : 0;
    const resource = parts[idx] ?? '';
    const remainder = '/' + parts.slice(idx).join('/');
    const map: Record<string, string> = {
      auth: 'user-service',
      users: 'user-service',
      games: 'game-catalog-service',
      payments: 'payment-service',
      library: 'library-service',
      social: 'social-service',
      reviews: 'review-service',
      achievements: 'achievement-service',
      notifications: 'notification-service',
      downloads: 'download-service',
      security: 'security-service',
    };
    const service = map[resource];
    return { targetService: service, remainderPath: remainder };
  }

  private composeUrl(baseUrl: string, remainderPath: string, originalUrl: string): string {
    const qIndex = originalUrl.indexOf('?');
    const qs = qIndex >= 0 ? originalUrl.substring(qIndex) : '';
    const base = baseUrl.replace(/\/$/, '');
    return `${base}${remainderPath}${qs}`;
  }

  private buildForwardHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
    const hopByHop = new Set([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
      'host',
      'content-length',
    ]);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      const key = k.toLowerCase();
      if (hopByHop.has(key)) continue;
      if (Array.isArray(v)) out[key] = v.join(', ');
      else if (typeof v === 'string') out[key] = v;
    }
    out['x-forwarded-proto'] = 'http';
    out['x-forwarded-host'] = headers['host'] as string;
    out['x-forwarded-for'] = [headers['x-forwarded-for'] as string, headers['x-real-ip'] as string]
      .filter(Boolean)
      .join(', ');
    return out;
  }

  private allowRequest(serviceName: string, config: ServiceConfig): boolean {
    const state = this.circuitStates.get(serviceName);
    const now = Date.now();
    const { circuitBreaker } = config;
    const resetTimeout = circuitBreaker?.resetTimeout ?? 30000;
    if (state?.state === 'open') {
      if (state.openedAt && now - state.openedAt >= resetTimeout) {
        // Move to half-open, allow a trial
        state.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }

  private recordSuccess(serviceName: string): void {
    const state = this.circuitStates.get(serviceName);
    if (!state) return;
    // On success, close breaker and reset counters
    this.circuitStates.set(serviceName, {
      state: 'closed',
      failures: 0,
      firstFailureAt: null,
      openedAt: null,
    });
  }

  private recordFailure(serviceName: string, config: ServiceConfig): void {
    const now = Date.now();
    const { circuitBreaker } = config;
    const failureThreshold = circuitBreaker?.failureThreshold ?? 5;
    const monitoringPeriod = circuitBreaker?.monitoringPeriod ?? 60000;

    const prev = this.circuitStates.get(serviceName) ?? {
      state: 'closed',
      failures: 0,
      firstFailureAt: null,
      openedAt: null,
    } as CircuitState;

    // Reset window if expired
    if (prev.firstFailureAt && now - prev.firstFailureAt > monitoringPeriod) {
      prev.failures = 0;
      prev.firstFailureAt = null;
    }
    prev.failures += 1;
    if (!prev.firstFailureAt) prev.firstFailureAt = now;

    if (prev.failures >= failureThreshold) {
      this.circuitStates.set(serviceName, {
        state: 'open',
        failures: prev.failures,
        firstFailureAt: prev.firstFailureAt,
        openedAt: now,
      });
    } else {
      this.circuitStates.set(serviceName, prev);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
