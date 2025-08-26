import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from './password-reset.service';
import { UserService } from './user.service';
import { UserTokenService } from './user-token.service';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { Email } from '../../domain/value-objects/email.value-object';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let userService: UserService;
  let tokenService: UserTokenService;
  let emailService: IEmailService;

  const mockUserService = { findByEmail: jest.fn(), updatePassword: jest.fn() };
  const mockTokenService = { generateToken: jest.fn(), validateAndUseToken: jest.fn() };
  const mockEmailService = { sendPasswordResetEmail: jest.fn(), sendVerificationEmail: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: UserService, useValue: mockUserService },
        { provide: UserTokenService, useValue: mockTokenService },
        { provide: IEmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<UserTokenService>(UserTokenService);
    emailService = module.get<IEmailService>(IEmailService);
  });

  it('should request a password reset and send an email', async () => {
    const email = new Email('test@example.com');
    mockUserService.findByEmail.mockResolvedValue({ id: 'user-id', email: email.getValue() });
    mockTokenService.generateToken.mockResolvedValue('reset-token');

    await service.requestPasswordReset(email);

    expect(mockTokenService.generateToken).toHaveBeenCalledWith('user-id', 'password_reset', 2);
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(email.getValue(), 'reset-token');
  });
});
