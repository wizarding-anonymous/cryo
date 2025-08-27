import { Injectable } from '@nestjs/common';
import { IEmailService } from '../../domain/interfaces/email.interface';

@Injectable()
export class MockEmailService implements IEmailService {
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    console.log(`[MOCK EMAIL] Password reset email sent to ${email} with token: ${resetToken}`);
  }

  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    console.log(`[MOCK EMAIL] Verification email sent to ${email} with token: ${verificationToken}`);
  }
}