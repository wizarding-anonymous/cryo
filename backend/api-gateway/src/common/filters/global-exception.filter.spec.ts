import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const makeHost = (url = '/api/x') => {
  const headers: Record<string, any> = {};
  const req = { headers, originalUrl: url } as any;
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(s: number) {
      this.statusCode = s;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
  const host = ({ switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any) as ArgumentsHost;
  return { host, res };
};

describe('GlobalExceptionFilter', () => {
  it('formats HttpException', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    filter.catch(new HttpException({ error: 'E', message: 'm' }, 400), host);
    expect(res.statusCode).toBe(400);
    expect(res.headers['X-Request-Id']).toBeDefined();
    expect(res.body.error).toBe('E');
  });

  it('handles unknown error', () => {
    const filter = new GlobalExceptionFilter();
    const { host, res } = makeHost();
    filter.catch(new Error('oops'), host);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('oops');
  });
});

