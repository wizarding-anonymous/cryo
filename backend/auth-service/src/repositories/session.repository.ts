import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  async create(sessionData: Partial<Session>): Promise<Session> {
    const session = this.sessionRepository.create(sessionData);
    return await this.sessionRepository.save(session);
  }

  async findById(id: string): Promise<Session | null> {
    return await this.sessionRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all sessions (active and inactive) for a user
   * Requirements: 13.3
   */
  async findAllByUserId(userId: string): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Count active sessions for a user
   * Requirements: 13.3
   */
  async countActiveSessionsByUserId(userId: string): Promise<number> {
    return await this.sessionRepository.count({
      where: { userId, isActive: true },
    });
  }

  async findByAccessToken(accessToken: string): Promise<Session | null> {
    return await this.sessionRepository.findOne({
      where: { accessToken, isActive: true },
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true },
    });
  }

  async updateLastAccessed(id: string): Promise<void> {
    await this.sessionRepository.update(id, {
      lastAccessedAt: new Date(),
    });
  }

  async deactivateSession(id: string): Promise<void> {
    await this.sessionRepository.update(id, {
      isActive: false,
    });
  }

  async deactivateAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();
    return result.affected || 0;
  }

  /**
   * Get session statistics for monitoring
   * Requirements: 13.2, 13.4, 13.7
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    totalExpiredSessions: number;
    sessionsPerUser: Record<string, number>;
  }> {
    // Count active sessions
    const totalActiveSessions = await this.sessionRepository.count({
      where: { isActive: true },
    });

    // Count expired sessions (not yet cleaned up)
    const totalExpiredSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.isActive = :isActive', { isActive: true })
      .andWhere('session.expiresAt < :now', { now: new Date() })
      .getCount();

    // Get sessions per user
    const userSessionCounts = await this.sessionRepository
      .createQueryBuilder('session')
      .select('session.userId', 'userId')
      .addSelect('COUNT(*)', 'sessionCount')
      .where('session.isActive = :isActive', { isActive: true })
      .groupBy('session.userId')
      .getRawMany();

    const sessionsPerUser: Record<string, number> = {};
    userSessionCounts.forEach(row => {
      sessionsPerUser[row.userId] = parseInt(row.sessionCount);
    });

    return {
      totalActiveSessions,
      totalExpiredSessions,
      sessionsPerUser,
    };
  }

  /**
   * Find sessions by IP address for security monitoring
   * Requirements: 13.2
   */
  async findSessionsByIpAddress(ipAddress: string): Promise<Session[]> {
    return await this.sessionRepository.find({
      where: { ipAddress, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find sessions that haven't been accessed recently
   * Requirements: 13.7
   */
  async findStaleSessionsOlderThan(hours: number): Promise<Session[]> {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.isActive = :isActive', { isActive: true })
      .andWhere('(session.lastAccessedAt IS NULL OR session.lastAccessedAt < :cutoffDate)', 
        { cutoffDate })
      .orderBy('session.lastAccessedAt', 'ASC')
      .getMany();
  }

  /**
   * Update session metadata (IP address, user agent)
   * Requirements: 13.2
   */
  async updateSessionMetadata(id: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.sessionRepository.update(id, {
      ipAddress,
      userAgent,
      lastAccessedAt: new Date(),
    });
  }
}