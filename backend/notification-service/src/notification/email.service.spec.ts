import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import * as fs from 'fs/promises';

import { EmailService, EmailProvider } from './email.service';
import { Notification } from '../entities';
import { NotificationType } from '../common/enums';

jest.mock('fs/promises'); // Mock the fs/promises module

describe('EmailService', () => {
  let service: EmailService;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn().mockReturnValue(of({ data: 'ok' })),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send email via Mail.ru provider', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_PROVIDER: EmailProvider.MAILRU,
          EMAIL_URL: 'https://api.mail.ru/v1/email/send',
          EMAIL_API_KEY: 'mailru-api-key',
          EMAIL_FROM: 'test@mail.ru',
        };
        return config[key];
      });

      await service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.mail.ru/v1/email/send',
        {
          to: [{ email: 'to@test.com' }],
          from: { email: 'test@mail.ru', name: 'Игровая Платформа' },
          subject: 'Subject',
          html: '<h1>Hello</h1>',
          text: 'Hello',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mailru-api-key',
          },
        },
      );
    });

    it('should send email via Yandex provider', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_PROVIDER: EmailProvider.YANDEX,
          EMAIL_URL: 'https://api.yandex.ru/v1/mail/send',
          EMAIL_API_KEY: 'yandex-api-key',
          EMAIL_FROM: 'test@yandex.ru',
        };
        return config[key];
      });

      await service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.yandex.ru/v1/mail/send',
        {
          to_email: 'to@test.com',
          from_email: 'test@yandex.ru',
          from_name: 'Игровая Платформа',
          subject: 'Subject',
          html_body: '<h1>Hello</h1>',
          text_body: 'Hello',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Yandex-API-Key': 'yandex-api-key',
          },
        },
      );
    });

    it('should send email via generic provider', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_PROVIDER: EmailProvider.GENERIC,
          EMAIL_URL: 'https://api.generic.com/send',
          EMAIL_API_KEY: 'generic-api-key',
          EMAIL_FROM: 'test@generic.com',
        };
        return config[key];
      });

      await service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>');

      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.generic.com/send',
        {
          to: 'to@test.com',
          from: 'test@generic.com',
          subject: 'Subject',
          html: '<h1>Hello</h1>',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': 'generic-api-key',
          },
        },
      );
    });

    it('should throw error if config is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);

      await expect(
        service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>'),
      ).rejects.toThrow('Email provider configuration is incomplete');

      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('sendNotificationEmail', () => {
    it('should use correct template for purchase notification', async () => {
      const mockNotification = {
        title: 'Покупка завершена',
        message: 'Игра добавлена в библиотеку',
        type: NotificationType.PURCHASE,
      } as Notification;

      const sendEmailWithRetrySpy = jest
        .spyOn(service, 'sendEmailWithRetry')
        .mockResolvedValue();
      (fs.readFile as jest.Mock).mockResolvedValue(
        '<h1>{{title}}</h1><p>{{message}}</p>',
      );

      await service.sendNotificationEmail('to@test.com', mockNotification);

      expect(sendEmailWithRetrySpy).toHaveBeenCalledWith(
        'to@test.com',
        'Покупка завершена',
        '<h1>Покупка завершена</h1><p>Игра добавлена в библиотеку</p>',
      );
    });

    it('should use correct template for achievement notification', async () => {
      const mockNotification = {
        title: 'Новое достижение!',
        message: 'Вы получили достижение "Первая победа"',
        type: NotificationType.ACHIEVEMENT,
      } as Notification;

      const sendEmailWithRetrySpy = jest
        .spyOn(service, 'sendEmailWithRetry')
        .mockResolvedValue();
      (fs.readFile as jest.Mock).mockResolvedValue(
        '<h1>{{title}}</h1><p>{{message}}</p>',
      );

      await service.sendNotificationEmail('to@test.com', mockNotification);

      expect(sendEmailWithRetrySpy).toHaveBeenCalledWith(
        'to@test.com',
        'Новое достижение!',
        '<h1>Новое достижение!</h1><p>Вы получили достижение "Первая победа"</p>',
      );
    });

    it('should use default template for unknown notification type', async () => {
      const mockNotification = {
        id: 'test-id',
        userId: 'test-user',
        title: 'Системное уведомление',
        message: 'Важная информация',
        type: 'unknown_type' as any,
        isRead: false,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Notification;

      const sendEmailWithRetrySpy = jest
        .spyOn(service, 'sendEmailWithRetry')
        .mockResolvedValue();
      (fs.readFile as jest.Mock).mockResolvedValue(
        '<h1>{{title}}</h1><p>{{message}}</p>',
      );

      await service.sendNotificationEmail('to@test.com', mockNotification);

      expect(sendEmailWithRetrySpy).toHaveBeenCalledWith(
        'to@test.com',
        'Системное уведомление',
        '<h1>Системное уведомление</h1><p>Важная информация</p>',
      );
    });
  });

  describe('sendEmailWithRetry', () => {
    let testService: EmailService;

    beforeEach(async () => {
      // Create a fresh service instance for retry tests with proper config
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockImplementation((key: string, defaultValue?: any) => {
                  const config: Record<string, any> = {
                    EMAIL_PROVIDER: EmailProvider.GENERIC,
                    EMAIL_URL: 'https://api.generic.com/send',
                    EMAIL_API_KEY: 'generic-api-key',
                    EMAIL_FROM: 'test@generic.com',
                    EMAIL_MAX_RETRIES: 3,
                    EMAIL_RETRY_DELAY: 100,
                  };
                  return config[key] !== undefined ? config[key] : defaultValue;
                }),
            },
          },
          {
            provide: HttpService,
            useValue: {
              post: jest.fn(),
            },
          },
        ],
      }).compile();

      testService = testModule.get<EmailService>(EmailService);
    });

    it('should succeed on first attempt', async () => {
      const sendEmailSpy = jest
        .spyOn(testService, 'sendEmail')
        .mockResolvedValue();

      await testService.sendEmailWithRetry(
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const sendEmailSpy = jest
        .spyOn(testService, 'sendEmail')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      // Mock delay to speed up test
      jest.spyOn(testService as any, 'delay').mockResolvedValue(undefined);

      await testService.sendEmailWithRetry(
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );

      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const sendEmailSpy = jest
        .spyOn(testService, 'sendEmail')
        .mockRejectedValue(new Error('Network error'));

      // Mock delay to speed up test
      jest.spyOn(testService as any, 'delay').mockResolvedValue(undefined);

      await expect(
        testService.sendEmailWithRetry(
          'to@test.com',
          'Subject',
          '<h1>Hello</h1>',
        ),
      ).rejects.toThrow('Network error');

      expect(sendEmailSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags and decode entities', () => {
      const html = '<h1>Title</h1><p>Message with &nbsp; and &amp;</p>';
      const result = (service as any).stripHtml(html);
      expect(result).toBe('Title\nMessage with   and &');
    });
  });

  describe('getEmailBody (private method test)', () => {
    it('should read and replace placeholders in a template', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(
        'Title: {{title}}, Msg: {{message}}',
      );
      const body = await (service as any).getEmailBody('test', {
        title: 'Hi',
        message: 'There',
      });
      expect(body).toBe('Title: Hi, Msg: There');
    });

    it('should return fallback html if template read fails', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      const body = await (service as any).getEmailBody('test', {
        title: 'Hi',
        message: 'There',
      });
      expect(body).toBe('<h1>Hi</h1><p>There</p>');
    });
  });

  describe('buildEmailPayload (private method test)', () => {
    it('should build correct payload for Mail.ru provider', () => {
      const config = {
        provider: EmailProvider.MAILRU,
        url: 'https://api.mail.ru/send',
        apiKey: 'key',
        fromEmail: 'test@mail.ru',
      };

      const payload = (service as any).buildEmailPayload(
        config,
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );

      expect(payload).toEqual({
        to: [{ email: 'to@test.com' }],
        from: { email: 'test@mail.ru', name: 'Игровая Платформа' },
        subject: 'Subject',
        html: '<h1>Hello</h1>',
        text: 'Hello',
      });
    });

    it('should build correct payload for Yandex provider', () => {
      const config = {
        provider: EmailProvider.YANDEX,
        url: 'https://api.yandex.ru/send',
        apiKey: 'key',
        fromEmail: 'test@yandex.ru',
      };

      const payload = (service as any).buildEmailPayload(
        config,
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );

      expect(payload).toEqual({
        to_email: 'to@test.com',
        from_email: 'test@yandex.ru',
        from_name: 'Игровая Платформа',
        subject: 'Subject',
        html_body: '<h1>Hello</h1>',
        text_body: 'Hello',
      });
    });

    it('should build correct payload for generic provider', () => {
      const config = {
        provider: EmailProvider.GENERIC,
        url: 'https://api.generic.com/send',
        apiKey: 'key',
        fromEmail: 'test@generic.com',
      };

      const payload = (service as any).buildEmailPayload(
        config,
        'to@test.com',
        'Subject',
        '<h1>Hello</h1>',
      );

      expect(payload).toEqual({
        to: 'to@test.com',
        from: 'test@generic.com',
        subject: 'Subject',
        html: '<h1>Hello</h1>',
      });
    });
  });

  describe('buildEmailHeaders (private method test)', () => {
    it('should build correct headers for Mail.ru provider', () => {
      const config = {
        provider: EmailProvider.MAILRU,
        apiKey: 'mailru-key',
      };

      const headers = (service as any).buildEmailHeaders(config);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer mailru-key',
      });
    });

    it('should build correct headers for Yandex provider', () => {
      const config = {
        provider: EmailProvider.YANDEX,
        apiKey: 'yandex-key',
      };

      const headers = (service as any).buildEmailHeaders(config);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Yandex-API-Key': 'yandex-key',
      });
    });

    it('should build correct headers for generic provider', () => {
      const config = {
        provider: EmailProvider.GENERIC,
        apiKey: 'generic-key',
      };

      const headers = (service as any).buildEmailHeaders(config);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Api-Key': 'generic-key',
      });
    });

    it('should handle missing API key', () => {
      const config = {
        provider: EmailProvider.GENERIC,
        apiKey: undefined,
      };

      const headers = (service as any).buildEmailHeaders(config);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
      });
    });
  });

  describe('getTemplateNameByType (private method test)', () => {
    it('should return correct template names for different notification types', () => {
      expect((service as any).getTemplateNameByType('purchase')).toBe('purchase');
      expect((service as any).getTemplateNameByType('achievement')).toBe('achievement');
      expect((service as any).getTemplateNameByType('friend_request')).toBe('friend-request');
      expect((service as any).getTemplateNameByType('game_update')).toBe('notification');
      expect((service as any).getTemplateNameByType('system')).toBe('notification');
      expect((service as any).getTemplateNameByType('unknown')).toBe('notification');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle HTTP service errors', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_PROVIDER: EmailProvider.GENERIC,
          EMAIL_URL: 'https://api.generic.com/send',
          EMAIL_API_KEY: 'generic-api-key',
          EMAIL_FROM: 'test@generic.com',
        };
        return config[key];
      });

      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      await expect(
        service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>')
      ).rejects.toThrow('Network error');
    });

    it('should handle complex HTML stripping', () => {
      const complexHtml = `
        <div>
          <h1>Title</h1>
          <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
          <br/>
          <div>Another div with &nbsp;&amp;&lt;&gt; entities</div>
        </div>
      `;

      const result = (service as any).stripHtml(complexHtml);
      
      expect(result).toContain('Title');
      expect(result).toContain('Paragraph with bold and italic text.');
      expect(result).toContain('Another div with  &<> entities');
      // Note: The stripHtml method may not remove all HTML entities perfectly
      // This is acceptable for the MVP as it's primarily for fallback text
    });

    it('should handle empty or null email configuration gracefully', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);

      await expect(
        service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>')
      ).rejects.toThrow('Email provider configuration is incomplete');
    });

    it('should handle partial email configuration', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_PROVIDER: EmailProvider.GENERIC,
          EMAIL_URL: 'https://api.generic.com/send',
          // Missing EMAIL_API_KEY and EMAIL_FROM
        };
        return config[key];
      });

      await expect(
        service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>')
      ).rejects.toThrow('Email provider configuration is incomplete');
    });

    it('should handle delay function', async () => {
      const start = Date.now();
      await (service as any).delay(100);
      const end = Date.now();
      
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });
});
