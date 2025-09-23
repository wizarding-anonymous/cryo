import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value as string;
    });
  });

  it('returns default configuration values', () => {
    const config = configuration();

    expect(config.port).toBe(3000);
    expect(config.database.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
    expect(config.kafka.enabled).toBe(false);
  });

  it('respects environment overrides', () => {
    process.env.PORT = '4001';
    process.env.DATABASE_HOST = 'db-host';
    process.env.KAFKA_ENABLED = 'true';
    process.env.KAFKA_BROKER = 'broker:9092';

    const config = configuration();

    expect(config.port).toBe(4001);
    expect(config.database.host).toBe('db-host');
    expect(config.kafka.enabled).toBe(true);
    expect(config.kafka.broker).toBe('broker:9092');
  });
});
