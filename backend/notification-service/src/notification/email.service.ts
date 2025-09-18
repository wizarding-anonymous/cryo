import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Notification } from '../../entities';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

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
    } catch (error) {
      this.logger.error(
        `Failed to read email template: ${templateName}`,
        error,
      );
      // Fallback to a very simple text version
      return `<h1>${data.title}</h1><p>${data.message}</p>`;
    }
  }

  async sendNotificationEmail(
    to: string,
    notification: Notification,
  ): Promise<void> {
    const subject = notification.title;
    const body = await this.getEmailBody('notification', {
      title: notification.title,
      message: notification.message,
    });

    await this.sendEmail(to, subject, body);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const mailerUrl = this.configService.get<string>('MAILER_URL');
    const mailerApiKey = this.configService.get<string>('MAILER_API_KEY');
    const mailerFrom = this.configService.get<string>('MAILER_FROM_EMAIL');

    if (!mailerUrl || !mailerApiKey || !mailerFrom) {
      this.logger.error(
        'Email provider settings are missing in .env. Skipping email send.',
      );
      return;
    }

    const payload = {
      to,
      from: mailerFrom,
      subject,
      html,
    };

    try {
      await firstValueFrom(
        this.httpService.post(mailerUrl, payload, {
          headers: { 'X-Api-Key': mailerApiKey },
        }),
      );
      this.logger.log(
        `Successfully sent email to ${to} with subject "${subject}"`,
      );
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      // In a real app, we might want to throw an exception or queue for retry
    }
  }
}
