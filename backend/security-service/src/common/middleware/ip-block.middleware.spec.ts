import { IpBlockMiddleware } from './ip-block.middleware';

describe('IpBlockMiddleware', () => {
  it('returns 403 when IP is blocked', async () => {
    const security = { isIPBlocked: jest.fn(async () => true) } as any;
    const mw = new IpBlockMiddleware(security);
    const req: any = { ip: '1.2.3.4', headers: {}, originalUrl: '/x' };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();
    await mw.use(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when IP is not blocked', async () => {
    const security = { isIPBlocked: jest.fn(async () => false) } as any;
    const mw = new IpBlockMiddleware(security);
    const req: any = { ip: '1.2.3.4', headers: {}, originalUrl: '/x' };
    const res: any = {};
    const next = jest.fn();
    await mw.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

