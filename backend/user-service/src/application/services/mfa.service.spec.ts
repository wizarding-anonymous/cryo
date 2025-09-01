import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MfaService } from './mfa.service';
import { User } from '../../domain/entities/user.entity';
import { BadRequestException } from '@nestjs/common';

describe('MfaService', () => {
  let service: MfaService;
  let userRepository: Repository<User>;

  const mockUserRepo = {
    update: jest.fn(),
    findOneBy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MfaService, { provide: getRepositoryToken(User), useValue: mockUserRepo }],
    }).compile();

    service = module.get<MfaService>(MfaService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should enable MFA and return a secret and QR code', async () => {
    const result = await service.enableMfa('user-id', 'test@example.com');

    expect(result).toHaveProperty('secret');
    expect(result).toHaveProperty('otpauthUrl');
    expect(result).toHaveProperty('qrCodeDataUrl');
    expect(mockUserRepo.update).toHaveBeenCalledWith('user-id', { mfaSecret: expect.any(String) });
  });

  it('should throw an error for an invalid verification token', async () => {
    const user = { id: 'user-id', mfaSecret: 'asecret' };
    mockUserRepo.findOneBy.mockResolvedValue(user);

    // otplib.verify will return false for a wrong token
    await expect(service.verifyAndActivateMfa('user-id', 'wrong-token')).rejects.toThrow(BadRequestException);
  });
});
