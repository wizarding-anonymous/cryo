import { Test, TestingModule } from '@nestjs/testing';
import { MockGameKeysService } from '../mock.game-keys.service';

describe('MockGameKeysService', () => {
  let service: MockGameKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockGameKeysService],
    }).compile();

    service = module.get<MockGameKeysService>(MockGameKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('activateKey', () => {
    const userId = 'test-user-id';

    it('should return success for a special valid key', async () => {
      const result = await service.activateKey(userId, 'GOOD-VALID-KEY-0000-0000-0000');
      expect(result.success).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return success for a generic valid key with correct format', async () => {
        const result = await service.activateKey(userId, 'ABCD-1234-EFGH-5678');
        expect(result.success).toBe(true);
        expect(result.gameId).toBeDefined();
        expect(result.error).toBeUndefined();
      });

    it('should return failure for an invalid key format', async () => {
      const result = await service.activateKey(userId, 'invalid-key-format');
      expect(result.success).toBe(false);
      expect(result.error).toEqual('Invalid key format.');
      expect(result.gameId).toBeUndefined();
    });

    it('should return failure for a special used key', async () => {
      const result = await service.activateKey(userId, 'USED-KEY-0000-0000-0000-0000');
      expect(result.success).toBe(false);
      expect(result.error).toEqual('This key has already been used.');
    });

    it('should return failure for a generic key that has been used', async () => {
      const validKey = 'ABCD-EFGH-IJKL-MNOP';
      // First activation should succeed
      await service.activateKey(userId, validKey);
      // Second activation should fail
      const result = await service.activateKey(userId, validKey);
      expect(result.success).toBe(false);
      expect(result.error).toEqual('This key has already been used.');
    });

    it('should return failure for a region-locked key', async () => {
      const result = await service.activateKey(userId, 'REGION-LOCKD-KEY-0000-0000-0000');
      expect(result.success).toBe(false);
      expect(result.error).toEqual('This key is not available in your region.');
    });

    it('should return a consistent gameId for all good keys', async () => {
        const result1 = await service.activateKey(userId, 'GOOD-VALID-KEY-0000-0000-0000');
        const result2 = await service.activateKey(userId, 'AAAA-BBBB-CCCC-DDDD');
        expect(result1.gameId).toEqual('a1b2c3d4-e5f6-7890-1234-567890abcdef');
        expect(result2.gameId).toEqual('a1b2c3d4-e5f6-7890-1234-567890abcdef');
      });
  });
});
