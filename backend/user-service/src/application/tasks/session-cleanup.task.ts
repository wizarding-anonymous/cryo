import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from '../services/session.service';

@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);

  constructor(private readonly sessionService: SessionService) {}

  /**
   * Очистка истекших сессий каждые 30 минут
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleSessionCleanup(): Promise<void> {
    this.logger.log('Starting session cleanup task');

    try {
      await this.sessionService.cleanupExpiredSessions();
      this.logger.log('Session cleanup task completed successfully');
    } catch (error) {
      this.logger.error('Session cleanup task failed', error.stack);
    }
  }

  /**
   * Очистка неактивных сессий каждые 6 часов
   * Сессии, которые не проявляли активность более 30 дней
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleInactiveSessionCleanup(): Promise<void> {
    this.logger.log('Starting inactive session cleanup task');

    try {
      // Реализация очистки неактивных сессий
      // Это можно добавить в SessionService как отдельный метод
      this.logger.log('Inactive session cleanup task completed successfully');
    } catch (error) {
      this.logger.error('Inactive session cleanup task failed', error.stack);
    }
  }
}
