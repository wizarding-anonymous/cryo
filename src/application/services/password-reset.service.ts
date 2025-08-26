import { Injectable, Inject } from '@nestjs/common';
import { UserTokenService } from './user-token.service';
import { UserService } from './user.service';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { Email } from '../../domain/value-objects/email.value-object';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: UserTokenService,
    @Inject(IEmailService) private readonly emailService: IEmailService,
  ) {}

  async requestPasswordReset(email: Email): Promise<void> {
    const user = await this.userService.findByEmail(email.getValue());
    if (!user) {
      // Do not reveal if a user exists or not
      return;
    }

    const token = await this.tokenService.generateToken(
      user.id,
      'password_reset',
      2, // 2-hour expiration
    );

    await this.emailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.tokenService.validateAndUseToken(
      token,
      'password_reset',
    );
    await this.userService.updatePassword(userId, newPassword);
  }
}
