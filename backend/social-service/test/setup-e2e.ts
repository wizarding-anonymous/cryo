process.env.NODE_ENV = 'test';
process.env.CACHE_STORE = 'memory';
process.env.JWT_SECRET = 'test-secret';

jest.setTimeout(120000);
