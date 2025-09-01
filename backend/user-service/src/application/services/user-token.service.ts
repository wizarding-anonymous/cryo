import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { UserToken, TokenType } from '../../domain/entities/user-token.entity';

@Injectable()
export class UserTokenService {
  constructor(
    @InjectRepository(UserToken)
    private readonly tokenRepository: Repository<UserToken>,
  ) {}

  async generateToken(userId: string, type: TokenType, expirationHours: number = 24): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

    const tokenRecord = this.tokenRepository.create({
      userId,
      token,
      tokenType: type,
      expiresAt,
    });
    await this.tokenRepository.save(tokenRecord);

    return token;
  }

  async validateAndUseToken(token: string, expectedType: TokenType): Promise<{ userId: string }> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: {
        token,
        tokenType: expectedType,
        usedAt: IsNull(),
      },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    tokenRecord.usedAt = new Date();
    await this.tokenRepository.save(tokenRecord);

    return { userId: tokenRecord.userId };
  }
}
