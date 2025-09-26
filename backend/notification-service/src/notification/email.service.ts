import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Notification } from '../entities';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum EmailProvider {
  MAILRU = 'mailru',
  YANDEX = 'yandex',
  GENERIC = 'generic',
}

export interface EmailConfig {
  provider: EmailProvider;
  url: string | undefined;
  apiKey: string | undefined;
  fromEmail: string | undefined;
  maxRetries?: number;
  retryDelay?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.maxRetries = this.configService.get<number>('EMAIL_MAX_RETRIES', 3);
    this.retryDelay = this.configService.get<number>('EMAIL_RETRY_DELAY', 1000);
  }

  private async getEmailBody(
    templateName: string,
    data: { title: string; message: string },
  ): Promise<string> {
    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.html`,
    );
    try {
      let template = await fs.readFile(templatePath, 'utf-8');
      template = template.replace('{{title}}', data.title);
      template = template.replace('{{message}}', data.message);
      return template;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to read email template: ${templateName}`,
        error,
      );
      // Fallback to a very simple text version
      return `<h1>${data.title}</h1><p>${data.message}</p>`;
    }
  }

  /**
   * Получить конфигурацию email провайдера
   */
  private getEmailConfig(): EmailConfig {
    const provider = this.configService.get<string>(
      'EMAIL_PROVIDER',
      'generic',
    ) as EmailProvider;
    const url = this.configService.get<string>('EMAIL_URL');
    const apiKey = this.configService.get<string>('EMAIL_API_KEY');
    const fromEmail = this.configService.get<string>('EMAIL_FROM');

    return {
      provider,
      url,
      apiKey,
      fromEmail,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }

  /**
   * Отправить уведомление по email с поддержкой retry логики
   */
  async sendNotificationEmail(
    to: string,
    notification: Notification,
  ): Promise<void> {
    const subject = notification.title;
    const templateName = this.getTemplateNameByType(notification.type);
    const body = await this.getEmailBody(templateName, {
      title: notification.title,
      message: notification.message,
    });

    await this.sendEmailWithRetry(to, subject, body);
  }

  /**
   * Получить имя шаблона по типу уведомления
   */
  private getTemplateNameByType(type: string): string {
    const templateMap: Record<string, string> = {
      purchase: 'purchase',
      achievement: 'achievement',
      friend_request: 'friend-request',
      game_update: 'notification',
      system: 'notification',
    };

    return templateMap[type] || 'notification';
  }

  /**
   * Отправить email с retry логикой
   */
  async sendEmailWithRetry(
    to: string,
    subject: string,
    html: string,
    attempt: number = 1,
  ): Promise<void> {
    try {
      await this.sendEmail(to, subject, html);
      this.logger.log(
        `Successfully sent email to ${to} with subject "${subject}" on attempt ${attempt}`,
      );
    } catch (error: unknown) {
      if (attempt < this.maxRetries) {
        this.logger.warn(
          `Failed to send email to ${to} on attempt ${attempt}. Retrying in ${this.retryDelay}ms...`,
          error instanceof Error ? error.message : String(error),
        );

        await this.delay(this.retryDelay);
        return this.sendEmailWithRetry(to, subject, html, attempt + 1);
      } else {
        this.logger.error(
          `Failed to send email to ${to} after ${this.maxRetries} attempts`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error;
      }
    }
  }

  /**
   * Отправить email через выбранного российского провайдера
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const config = this.getEmailConfig();

    if (!config.url || !config.apiKey || !config.fromEmail) {
      this.logger.error(
        'Email provider settings are missing in .env. Required: EMAIL_URL, EMAIL_API_KEY, EMAIL_FROM',
      );
      throw new Error('Email provider configuration is incomplete');
    }

    const payload = this.buildEmailPayload(config, to, subject, html);
    const headers = this.buildEmailHeaders(config);

    try {
      await firstValueFrom(
        this.httpService.post(config.url, payload, { headers }),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send email via ${config.provider} provider to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Построить payload для email в зависимости от провайдера
   */
  private buildEmailPayload(
    config: EmailConfig,
    to: string,
    subject: string,
    html: string,
  ): any {
    switch (config.provider) {
      case EmailProvider.MAILRU:
        return {
          to: [{ email: to }],
          from: { email: config.fromEmail || '', name: 'Игровая Платформа' },
          subject,
          html,
          text: this.stripHtml(html), // Mail.ru рекомендует отправлять и HTML и текст
        };

      case EmailProvider.YANDEX:
        return {
          to_email: to,
          from_email: config.fromEmail || '',
          from_name: 'Игровая Платформа',
          subject,
          html_body: html,
          text_body: this.stripHtml(html),
        };

      case EmailProvider.GENERIC:
      default:
        return {
          to,
          from: config.fromEmail || '',
          subject,
          html,
        };
    }
  }

  /**
   * Построить заголовки для email в зависимости от провайдера
   */
  private buildEmailHeaders(config: EmailConfig): Record<string, string> {
    const baseHeaders = {
      'Content-Type': 'application/json',
    };

    if (!config.apiKey) {
      return baseHeaders;
    }

    switch (config.provider) {
      case EmailProvider.MAILRU:
        return {
          ...baseHeaders,
          Authorization: `Bearer ${config.apiKey}`,
        };

      case EmailProvider.YANDEX:
        return {
          ...baseHeaders,
          'X-Yandex-API-Key': config.apiKey,
        };

      case EmailProvider.GENERIC:
      default:
        return {
          ...baseHeaders,
          'X-Api-Key': config.apiKey,
        };
    }
  }

  /**
   * Убрать HTML теги для текстовой версии
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<\/?(h[1-6]|p|div|br)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n+/g, '\n')
      .trim();
  }

  /**
   * Задержка для retry логики
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
