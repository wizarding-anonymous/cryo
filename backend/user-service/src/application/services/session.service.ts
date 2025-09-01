import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import { User } from '../../domain/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { EventPublisher } from '../events/event-publisher.service';

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  browserVersion: string;
  version: string;
  userAgent: string;
}

export interface SessionData {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createSession(
    userId: string,
    deviceInfo: DeviceInfo,
    ipAddress: string,
  ): Promise<{ session: SessionData; accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate JWT tokens
    const payload = { username: user.username, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Create session record
    const session = this.sessionRepository.create({
      userId,
      deviceInfo,
      ipAddress,
      userAgent: deviceInfo.userAgent,
      accessTokenHash: this.hashToken(accessToken),
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
    });

    const savedSession = await this.sessionRepository.save(session);

    // Publish session created event
    await this.eventPublisher.publish('user.session.created', {
      userId,
      sessionId: savedSession.id,
      deviceInfo,
      ipAddress,
      timestamp: new Date().toISOString(),
    });

    return {
      session: this.mapToSessionData(savedSession),
      accessToken,
      refreshToken,
    };
  }

  async getActiveSessions(userId: string): Promise<SessionData[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivityAt: 'DESC' },
    });

    return sessions.map(session => this.mapToSessionData(session));
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOneBy({ id: sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.isActive = false;
    session.terminatedReason = 'user_logout';
    session.terminatedAt = new Date();

    await this.sessionRepository.save(session);

    // Publish session terminated event
    await this.eventPublisher.publish('user.session.terminated', {
      userId: session.userId,
      sessionId: session.id,
      reason: 'user_logout',
      timestamp: new Date().toISOString(),
    });
  }

  async terminateAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const query = this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({
        isActive: false,
        terminatedReason: 'user_action',
        terminatedAt: new Date(),
      })
      .where('userId = :userId AND isActive = true', { userId });

    if (exceptSessionId) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await query.execute();

    // Publish bulk session termination event
    await this.eventPublisher.publish('user.sessions.terminated', {
      userId,
      exceptSessionId,
      reason: 'user_action',
      timestamp: new Date().toISOString(),
    });
  }

  async validateSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.sessionRepository.findOneBy({
      id: sessionId,
      isActive: true,
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return this.mapToSessionData(session);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({
        isActive: false,
        terminatedReason: 'expired',
        terminatedAt: new Date(),
      })
      .where('expiresAt < :now AND isActive = true', { now: new Date() })
      .execute();
  }

  private hashToken(token: string): string {
    // Simple hash for demo - in production use proper crypto
    return Buffer.from(token).toString('base64').substring(0, 32);
  }

  private mapToSessionData(session: Session): SessionData {
    return {
      id: session.id,
      userId: session.userId,
      deviceInfo: session.deviceInfo as DeviceInfo,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      isActive: session.isActive,
    };
  }
}
