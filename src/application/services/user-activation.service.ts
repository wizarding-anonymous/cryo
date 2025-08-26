import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { UserActivationToken } from '../../domain/entities/user-activation-token.entity';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class UserActivationService {
  constructor(
    @InjectRepository(UserActivationToken)
    private readonly tokenRepository: Repository<UserActivationToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async generateActivationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const tokenRecord = this.tokenRepository.create({
      userId,
      token,
      expiresAt,
    });
    await this.tokenRepository.save(tokenRecord);

    return token;
  }

  async activateUser(token: string): Promise<void> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token, usedAt: IsNull() },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or already used activation token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Activation token has expired');
    }

    const user = await this.userRepository.findOneBy({ id: tokenRecord.userId });
    if (!user) {
        throw new NotFoundException('User associated with this token not found');
    }

    user.emailVerified = true;
    user.isActive = true;
    await this.userRepository.save(user);

    tokenRecord.usedAt = new Date();
    await this.tokenRepository.save(tokenRecord);
  }
}
