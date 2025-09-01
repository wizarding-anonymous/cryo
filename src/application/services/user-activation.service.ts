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

  async resendActivationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { email, emailVerified: false }
    });

    if (!user) {
      // Не раскрываем существование email для безопасности
      return {
        success: true,
        message: 'If this email exists and is not verified, an activation email has been sent.'
      };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Проверяем, не отправляли ли мы недавно письмо
    const recentToken = await this.userTokenRepository.findOne({
      where: { 
        userId: user.id, 
        type: 'activation', 
        isUsed: false 
      },
      order: { createdAt: 'DESC' }
    });

    if (recentToken && recentToken.createdAt > new Date(Date.now() - 5 * 60 * 1000)) {
      throw new BadRequestException('Activation email was sent recently. Please wait 5 minutes before requesting another.');
    }

    // Деактивируем старые токены
    await this.userTokenRepository.update(
      { userId: user.id, type: 'activation', isUsed: false },
      { isUsed: true, usedAt: new Date() }
    );

    // Генерируем новый токен
    const newToken = await this.generateActivationToken(user.id);

    // В реальной реализации здесь была бы отправка email
    console.log(`Resending activation email to ${email} with token: ${newToken}`);

    return {
      success: true,
      message: 'Activation email has been sent.'
    };
  }

  async checkActivationStatus(userId: string): Promise<{ isActive: boolean; emailVerified: boolean }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  }
}