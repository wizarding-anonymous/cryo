import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import * as fs from 'fs/promises';

import { EmailService } from './email.service';
import { Notification } from '../entities';

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
    it('should send an email successfully', async () => {
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('http://mailer.com') // MAILER_URL
        .mockReturnValueOnce('api-key') // MAILER_API_KEY
        .mockReturnValueOnce('from@test.com'); // MAILER_FROM_EMAIL

      await service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>');

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mailer.com',
        {
          to: 'to@test.com',
          from: 'from@test.com',
          subject: 'Subject',
          html: '<h1>Hello</h1>',
        },
        { headers: { 'X-Api-Key': 'api-key' } },
      );
    });

    it('should not send email if config is missing', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      await service.sendEmail('to@test.com', 'Subject', '<h1>Hello</h1>');
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });

  describe('sendNotificationEmail', () => {
    it('should call sendEmail with the correct template body', async () => {
      const mockNotification = {
        title: 'Title',
        message: 'Message',
      } as Notification;
      const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue();
      (fs.readFile as jest.Mock).mockResolvedValue(
        '<h1>{{title}}</h1><p>{{message}}</p>',
      );

      await service.sendNotificationEmail('to@test.com', mockNotification);

      expect(sendEmailSpy).toHaveBeenCalledWith(
        'to@test.com',
        'Title',
        '<h1>Title</h1><p>Message</p>',
      );
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
});
