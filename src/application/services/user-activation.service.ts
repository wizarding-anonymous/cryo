import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { UserToken } from '../../domain/entities/user-token.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class UserActivationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
  ) {}

  async generateActivationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    const userToken = this.userTokenRepository.create({
      userId,
      token,
      type: 'activation',
      expiresAt,
      isUsed: false,
    });

    await this.userTokenRepository.save(userToken);
    return token;
  }

  async activateUser(token: string): Promise<void> {
    const userToken = await this.userTokenRepository.findOne({
      where: { token, type: 'activation', isUsed: false },
      relations: ['user'],
    });

    if (!userToken) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    if (userToken.expiresAt < new Date()) {
      throw new BadRequestException('Activation token has expired');
    }

    const user = userToken.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Activate user
    user.isActive = true;
    user.emailVerified = true;
    await this.userRepository.save(user);

    // Mark token as used
    userToken.isUsed = true;
    userToken.usedAt = new Date();
    await this.userTokenRepository.save(userToken);
  }
}