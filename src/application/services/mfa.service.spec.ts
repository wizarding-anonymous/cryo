import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MfaService } from './mfa.service';
import { User } from '../../domain/entities/user.entity';
import { UserToken } from '../../domain/entities/user-token.entity';
import { EventPublisher } from '../events/event-publisher.service';
import { BadRequestException } from '@nestjs/common';

describe('MfaService', () => {
  let service: MfaService;
  let userRepository: Repository<User>;

  const mockUserRepo = {
    update: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockUserTokenRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockEventPublisher = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserToken), useValue: mockUserTokenRepo },
        { provide: EventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should enable TOTP MFA and return a secret and QR code', async () => {
    const mockUser = { id: 'user-id', email: 'test@example.com' };
    mockUserRepo.findOneBy.mockResolvedValue(mockUser);
    mockUserRepo.update.mockResolvedValue({});

    const result = await service.enableTotpMfa('user-id', 'test@example.com');

    expect(result).toHaveProperty('secret');
    expect(result).toHaveProperty('otpauthUrl');
    expect(result).toHaveProperty('qrCodeDataUrl');
    expect(result).toHaveProperty('backupCodes');
    expect(mockUserRepo.update).toHaveBeenCalledWith('user-id', {
      mfaSecret: expect.any(String),
      backupCodes: expect.any(Array)
    });
  });

  it('should throw an error for an invalid verification token', async () => {
    const user = { id: 'user-id', mfaSecret: 'asecret', mfaMethods: [] };
    mockUserRepo.findOneBy.mockResolvedValue(user);
    mockUserRepo.update.mockResolvedValue({});
    mockEventPublisher.publish.mockResolvedValue(undefined);

    // otplib.verify will return false for a wrong token
    await expect(service.verifyAndActivateTotpMfa('user-id', 'wrong-token')).rejects.toThrow(BadRequestException);
  });
});
