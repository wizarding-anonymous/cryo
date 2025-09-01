import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from '../../domain/interfaces/email.interface';

@Injectable()
export class MockEmailService implements IEmailService {
  private readonly logger = new Logger(MockEmailService.name);

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const activationLink = `${process.env.FRONTEND_URL}/activate?token=${token}`;

    this.logger.log(`📧 Sending verification email to: ${email}`);
    this.logger.log(`🔗 Activation link: ${activationLink}`);

    return Promise.resolve();
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    this.logger.log(`📧 Sending password reset email to: ${email}`);
    this.logger.log(`🔗 Reset link: ${resetLink}`);

    return Promise.resolve();
  }
}
