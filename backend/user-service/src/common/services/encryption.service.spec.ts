import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-encryption-key-32-chars-long'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plainText = 'Hello, World!';
      const encrypted = service.encrypt(plainText);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.encrypted).not.toBe(plainText);
      
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plainText);
    });

    it('should produce different encrypted results for same input', () => {
      const plainText = 'Same input';
      const encrypted1 = service.encrypt(plainText);
      const encrypted2 = service.encrypt(plainText);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // But both should decrypt to same value
      expect(service.decrypt(encrypted1)).toBe(plainText);
      expect(service.decrypt(encrypted2)).toBe(plainText);
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt objects correctly', () => {
      const testObject = {
        language: 'en',
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
        },
      };

      const encrypted = service.encryptObject(testObject);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('language');
      
      const decrypted = service.decryptObject(encrypted);
      expect(decrypted).toEqual(testObject);
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        preferences: {
          language: 'en',
          timezone: 'UTC',
          theme: 'dark' as const,
          notifications: {
            email: true,
            push: false,
            sms: true,
          },
          gameSettings: {
            autoDownload: false,
            cloudSave: true,
            achievementNotifications: true,
          },
        },
        metadata: {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
        },
      };

      const encrypted = service.encryptObject(complexObject);
      const decrypted = service.decryptObject(encrypted);
      expect(decrypted).toEqual(complexObject);
    });
  });

  describe('safe methods', () => {
    it('should handle null and undefined values safely', () => {
      expect(service.safeEncryptObject(null)).toBeNull();
      expect(service.safeEncryptObject(undefined)).toBeNull();
      expect(service.safeDecryptObject(null)).toBeNull();
      expect(service.safeDecryptObject(undefined)).toBeNull();
      expect(service.safeDecryptObject('')).toBeNull();
    });

    it('should encrypt and decrypt valid objects safely', () => {
      const testObject = { test: 'value' };
      const encrypted = service.safeEncryptObject(testObject);
      expect(encrypted).not.toBeNull();
      
      const decrypted = service.safeDecryptObject(encrypted);
      expect(decrypted).toEqual(testObject);
    });

    it('should return null for invalid encrypted data', () => {
      const invalidEncrypted = 'invalid-encrypted-data';
      const result = service.safeDecryptObject(invalidEncrypted);
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error if ENCRYPTION_KEY is not provided', async () => {
      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn().mockReturnValue(undefined),
              },
            },
          ],
        }).compile();

        module.get<EncryptionService>(EncryptionService);
      }).rejects.toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should handle decryption errors gracefully', () => {
      const invalidData = {
        encrypted: 'invalid',
        iv: 'invalid',
        tag: 'invalid',
      };

      expect(() => {
        service.decrypt(invalidData);
      }).toThrow('Decryption failed');
    });
  });
});