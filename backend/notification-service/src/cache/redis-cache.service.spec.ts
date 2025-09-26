import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  flushAll: jest.fn(),
  on: jest.fn(),
};

// Mock createClient function
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('RedisCacheService', () => {
  let service: RedisCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              switch (key) {
                case 'REDIS_HOST':
                  return 'localhost';
                case 'REDIS_PORT':
                  return 6379;
                case 'REDIS_PASSWORD':
                  return undefined;
                case 'REDIS_URL':
                  return undefined;
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisCacheService>(RedisCacheService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to Redis on module init', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'ready',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'end',
        expect.any(Function),
      );
    });

    it('should handle connection errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));

      await service.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(service.isRedisConnected()).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Redis on module destroy', async () => {
      mockRedisClient.quit.mockResolvedValue(undefined);

      // Simulate connected state
      await service.onModuleInit();
      // Simulate connection event
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null when not connected', async () => {
      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedisClient.set.mockResolvedValue('OK');

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.set('test-key', testData);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
      );
    });

    it('should set value with TTL', async () => {
      const testData = { id: '1', name: 'test' };
      mockRedisClient.setEx.mockResolvedValue('OK');

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.set('test-key', testData, 3600);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(testData),
      );
    });

    it('should return false when not connected', async () => {
      const result = await service.set('test-key', { data: 'test' });

      expect(result).toBe(false);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.set('test-key', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.del('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.del('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      const result = await service.del('test-key');

      expect(result).toBe(false);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.exists('non-existent-key');

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      const result = await service.exists('test-key');

      expect(result).toBe(false);
      expect(mockRedisClient.exists).not.toHaveBeenCalled();
    });
  });

  describe('keys', () => {
    it('should return matching keys', async () => {
      const expectedKeys = ['settings:user1', 'settings:user2'];
      mockRedisClient.keys.mockResolvedValue(expectedKeys);

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.keys('settings:*');

      expect(result).toEqual(expectedKeys);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('settings:*');
    });

    it('should return empty array when not connected', async () => {
      const result = await service.keys('settings:*');

      expect(result).toEqual([]);
      expect(mockRedisClient.keys).not.toHaveBeenCalled();
    });
  });

  describe('flushAll', () => {
    it('should flush all keys successfully', async () => {
      mockRedisClient.flushAll.mockResolvedValue('OK');

      // Simulate connected state
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      const result = await service.flushAll();

      expect(result).toBe(true);
      expect(mockRedisClient.flushAll).toHaveBeenCalled();
    });

    it('should return false when not connected', async () => {
      const result = await service.flushAll();

      expect(result).toBe(false);
      expect(mockRedisClient.flushAll).not.toHaveBeenCalled();
    });
  });

  describe('isRedisConnected', () => {
    it('should return connection status', async () => {
      expect(service.isRedisConnected()).toBe(false);

      // Simulate connection
      await service.onModuleInit();
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      expect(service.isRedisConnected()).toBe(true);
    });
  });
});
