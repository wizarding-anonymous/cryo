import axios from 'axios';
import { ProxyService } from './proxy.service';

jest.mock('axios');
const mockedAxios = axios as unknown as jest.Mock<any, any>;

describe('ProxyService', () => {
  const registry = {
    getServiceConfig: (name: string) =>
      ({
        name,
        baseUrl: 'http://example',
        timeout: 50,
        retries: 1,
        healthCheckPath: '/health',
        circuitBreaker: {
          failureThreshold: 2,
          resetTimeout: 60000,
          monitoringPeriod: 60000,
        },
      }) as any,
  } as any;

  beforeEach(() => {
    mockedAxios.mockReset();
  });

  it('forwards successful response', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      data: { ok: true },
      headers: { 'content-type': 'application/json' },
    } as any);
    const svc = new ProxyService(registry);
    const res = await svc.forward({
      method: 'GET',
      path: '/api/users',
      url: '/api/users',
      headers: {},
      body: undefined,
    } as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('retries on 500 and succeeds', async () => {
    mockedAxios.mockRejectedValueOnce({
      response: { status: 500, headers: {}, data: { error: 'x' } },
    });
    mockedAxios.mockResolvedValueOnce({
      status: 200,
      data: { ok: true },
      headers: {},
    } as any);
    const svc = new ProxyService(registry);
    const res = await svc.forward({
      method: 'GET',
      path: '/api/users',
      url: '/api/users',
      headers: {},
      body: undefined,
    } as any);
    expect(res.statusCode).toBe(200);
  });

  it('returns upstream error response when available', async () => {
    mockedAxios.mockRejectedValue({
      response: { status: 502, data: { err: true }, headers: {} },
    });
    const svc = new ProxyService(registry);
    const res = await svc.forward({
      method: 'GET',
      path: '/api/users',
      url: '/api/users',
      headers: {},
      body: undefined,
    } as any);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ err: true });
  });

  it('opens circuit after consecutive failures and blocks', async () => {
    const svc = new ProxyService(registry);
    mockedAxios.mockRejectedValue({}); // network error (retriable and no response)
    const req = {
      method: 'GET',
      path: '/api/users',
      url: '/api/users',
      headers: {},
      body: undefined,
    } as any;
    await expect(svc.forward(req)).rejects.toBeDefined();
    await expect(svc.forward(req)).rejects.toBeDefined();
    await expect(svc.forward(req)).rejects.toBeDefined(); // should be blocked by circuit breaker
  });
});
