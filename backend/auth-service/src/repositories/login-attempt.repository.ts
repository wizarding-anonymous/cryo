import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { LoginAttempt } from '../entities/login-attempt.entity';

@Injectable()
export class LoginAttemptRepository {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
  ) {}

  async create(attemptData: Partial<LoginAttempt>): Promise<LoginAttempt> {
    const attempt = this.loginAttemptRepository.create(attemptData);
    return await this.loginAttemptRepository.save(attempt);
  }

  async findRecentAttemptsByEmail(
    email: string,
    minutesBack: number = 15,
  ): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    return await this.loginAttemptRepository.find({
      where: {
        email,
        attemptedAt: MoreThan(cutoffTime),
      },
      order: { attemptedAt: 'DESC' },
    });
  }

  async findRecentAttemptsByIp(
    ipAddress: string,
    minutesBack: number = 15,
  ): Promise<LoginAttempt[]> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    return await this.loginAttemptRepository.find({
      where: {
        ipAddress,
        attemptedAt: MoreThan(cutoffTime),
      },
      order: { attemptedAt: 'DESC' },
    });
  }

  async countFailedAttemptsByEmail(
    email: string,
    minutesBack: number = 15,
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    return await this.loginAttemptRepository.count({
      where: {
        email,
        successful: false,
        attemptedAt: MoreThan(cutoffTime),
      },
    });
  }

  async countFailedAttemptsByIp(
    ipAddress: string,
    minutesBack: number = 15,
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    return await this.loginAttemptRepository.count({
      where: {
        ipAddress,
        successful: false,
        attemptedAt: MoreThan(cutoffTime),
      },
    });
  }

  async findByUserId(userId: string): Promise<LoginAttempt[]> {
    return await this.loginAttemptRepository.find({
      where: { userId },
      order: { attemptedAt: 'DESC' },
      take: 50, // Limit to last 50 attempts
    });
  }
}