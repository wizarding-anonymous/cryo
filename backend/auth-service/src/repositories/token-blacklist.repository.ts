import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TokenBlacklist } from '../entities/token-blacklist.entity';

@Injectable()
export class TokenBlacklistRepository {
  constructor(
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
  ) {}

  async create(blacklistData: Partial<TokenBlacklist>): Promise<TokenBlacklist> {
    const blacklistEntry = this.tokenBlacklistRepository.create(blacklistData);
    return await this.tokenBlacklistRepository.save(blacklistEntry);
  }

  async findByTokenHash(tokenHash: string): Promise<TokenBlacklist | null> {
    return await this.tokenBlacklistRepository.findOne({
      where: { tokenHash },
    });
  }

  async isTokenBlacklisted(tokenHash: string): Promise<boolean> {
    const entry = await this.findByTokenHash(tokenHash);
    if (!entry) {
      return false;
    }
    
    // Check if token has expired (should be cleaned up)
    if (entry.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  }

  async blacklistToken(
    tokenHash: string,
    userId: string,
    reason: TokenBlacklist['reason'],
    expiresAt: Date,
    metadata?: Record<string, any>,
  ): Promise<TokenBlacklist> {
    return await this.create({
      tokenHash,
      userId,
      reason,
      expiresAt,
      metadata,
    });
  }

  async blacklistAllUserTokens(
    userId: string,
    reason: TokenBlacklist['reason'] = 'security',
    metadata?: Record<string, any>,
  ): Promise<void> {
    // This would typically be called with a list of active token hashes for the user
    // For now, we'll just mark it in metadata that all tokens should be invalidated
    const farFutureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    
    await this.create({
      tokenHash: `user_${userId}_all_tokens_${Date.now()}`,
      userId,
      reason,
      expiresAt: farFutureDate,
      metadata: {
        ...metadata,
        type: 'bulk_invalidation',
        invalidateAllTokens: true,
      },
    });
  }

  async findByUserId(userId: string): Promise<TokenBlacklist[]> {
    return await this.tokenBlacklistRepository.find({
      where: { userId },
      order: { blacklistedAt: 'DESC' },
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenBlacklistRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  async countBlacklistedTokensByUser(userId: string): Promise<number> {
    return await this.tokenBlacklistRepository.count({
      where: { userId },
    });
  }
}