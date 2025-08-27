import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async enableMfa(userId: string, email: string): Promise<object> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'Russian Gaming Platform', secret);

    // In a real app, we would encrypt the secret before saving
    await this.userRepository.update(userId, { mfaSecret: secret });

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      // In a real app, we would also generate and return backup codes here
    };
  }

  async verifyAndActivateMfa(userId: string, token: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup has not been initiated for this user.');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid MFA token.');
    }

    await this.userRepository.update(userId, { mfaEnabled: true });
    return { success: true };
  }
}
