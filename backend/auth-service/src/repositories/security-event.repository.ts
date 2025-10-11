import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SecurityEvent } from '../entities/security-event.entity';

@Injectable()
export class SecurityEventRepository {
  constructor(
    @InjectRepository(SecurityEvent)
    private readonly securityEventRepository: Repository<SecurityEvent>,
  ) {}

  async create(eventData: Partial<SecurityEvent>): Promise<SecurityEvent> {
    const event = this.securityEventRepository.create(eventData);
    return await this.securityEventRepository.save(event);
  }

  async findById(id: string): Promise<SecurityEvent | null> {
    return await this.securityEventRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    return await this.securityEventRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findUnprocessedEvents(): Promise<SecurityEvent[]> {
    return await this.securityEventRepository.find({
      where: { processed: false },
      order: { createdAt: 'ASC' },
      take: 100, // Process in batches
    });
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.securityEventRepository.update(id, { processed: true });
  }

  async markMultipleAsProcessed(ids: string[]): Promise<void> {
    await this.securityEventRepository.update(ids, { processed: true });
  }

  async findRecentEventsByType(
    type: SecurityEvent['type'],
    hoursBack: number = 24,
  ): Promise<SecurityEvent[]> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return await this.securityEventRepository.find({
      where: {
        type,
        createdAt: MoreThan(cutoffTime),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findRecentEventsByIp(
    ipAddress: string,
    hoursBack: number = 24,
  ): Promise<SecurityEvent[]> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return await this.securityEventRepository.find({
      where: {
        ipAddress,
        createdAt: MoreThan(cutoffTime),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async countEventsByUserAndType(
    userId: string,
    type: SecurityEvent['type'],
    hoursBack: number = 24,
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return await this.securityEventRepository.count({
      where: {
        userId,
        type,
        createdAt: MoreThan(cutoffTime),
      },
    });
  }

  async logSecurityEvent(
    userId: string,
    type: SecurityEvent['type'],
    ipAddress: string,
    userAgent?: string,
    metadata?: Record<string, any>,
    severity?: SecurityEvent['severity'],
  ): Promise<SecurityEvent> {
    return await this.create({
      userId,
      type,
      ipAddress,
      userAgent,
      metadata,
      severity: severity || 'low',
      processed: false,
    });
  }
}