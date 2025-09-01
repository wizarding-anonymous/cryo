import { Test, TestingModule } from '@nestjs/testing';
import { MockGOSTEncryptionService } from './mock-gost-encryption.service';

describe('MockGOSTEncryptionService', () => {
  let service: MockGOSTEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockGOSTEncryptionService],
    }).compile();

    service = module.get<MockGOSTEncryptionService>(MockGOSTEncryptionService);
  });

  it('should encrypt and decrypt data', async () => {
    const data = { message: 'hello' };
    const encrypted = await service.encryptPersonalData(data);

    expect(encrypted).toContain('GOST_ENCRYPTED:');

    const decrypted = await service.decryptPersonalData(encrypted);
    expect(decrypted).toEqual(data);
  });
});
