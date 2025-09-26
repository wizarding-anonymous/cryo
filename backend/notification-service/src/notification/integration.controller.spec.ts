import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { GameCatalogEventDto, LibraryEventDto } from './dto';

describe('NotificationController - Integration Webhooks', () => {
  let app: INestApplication;

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /notifications/webhook/game-catalog', () => {
    it('should handle game update webhook', async () => {
      const gameUpdateEvent: GameCatalogEventDto = {
        eventType: 'game.updated',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'Cyberpunk 2077',
          updateType: 'patch',
          version: '2.1.0',
        },
      };

      mockNotificationService.createNotification.mockResolvedValue({
        id: 'notification-123',
        userId: 'user-123',
        type: 'GAME_UPDATE',
        title: 'Обновление игры: Cyberpunk 2077',
        message:
          'Доступно обновление 2.1.0 для игры "Cyberpunk 2077". Исправления и улучшения уже ждут вас!',
      });

      const response = await request(app.getHttpServer())
        .post('/notifications/webhook/game-catalog/updated')
        .send(gameUpdateEvent)
        .expect(HttpStatus.ACCEPTED);

      expect(response.body).toEqual({ status: 'accepted' });
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'game_update',
        title: 'Обновление игры: Cyberpunk 2077',
        message:
          'Доступно обновление 2.1.0 для игры "Cyberpunk 2077". Исправления и улучшения уже ждут вас!',
        metadata: gameUpdateEvent.data,
        channels: ['in_app', 'email'],
      });
    });

    it('should handle game sale webhook', async () => {
      const gameSaleEvent: GameCatalogEventDto = {
        eventType: 'game.sale_started',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'The Witcher 3',
          saleDiscount: 50,
        },
      };

      mockNotificationService.createNotification.mockResolvedValue({
        id: 'notification-124',
        userId: 'user-123',
        type: 'GAME_UPDATE',
        title: 'Скидка на игру: The Witcher 3',
        message:
          'Скидка 50% на игру "The Witcher 3"! Не упустите возможность приобрести игру по выгодной цене.',
      });

      const response = await request(app.getHttpServer())
        .post('/notifications/webhook/game-catalog/sale-started')
        .send(gameSaleEvent)
        .expect(HttpStatus.ACCEPTED);

      expect(response.body).toEqual({ status: 'accepted' });
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'game_update',
        title: 'Скидка на игру: The Witcher 3',
        message:
          'Скидка 50% на игру "The Witcher 3"! Не упустите возможность приобрести игру по выгодной цене.',
        metadata: gameSaleEvent.data,
        channels: ['in_app', 'email'],
      });
    });
  });

  describe('POST /notifications/webhook/library', () => {
    it('should handle game added to library webhook', async () => {
      const libraryAddEvent: LibraryEventDto = {
        eventType: 'library.game_added',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'Red Dead Redemption 2',
          addedAt: '2024-01-01T10:00:00Z',
        },
      };

      mockNotificationService.createNotification.mockResolvedValue({
        id: 'notification-125',
        userId: 'user-123',
        type: 'SYSTEM',
        title: 'Игра добавлена в библиотеку',
        message:
          'Игра "Red Dead Redemption 2" успешно добавлена в вашу библиотеку. Теперь вы можете скачать и играть!',
      });

      const response = await request(app.getHttpServer())
        .post('/notifications/webhook/library/game-added')
        .send(libraryAddEvent)
        .expect(HttpStatus.ACCEPTED);

      expect(response.body).toEqual({ status: 'accepted' });
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'system',
        title: 'Игра добавлена в библиотеку',
        message:
          'Игра "Red Dead Redemption 2" успешно добавлена в вашу библиотеку. Теперь вы можете скачать и играть!',
        metadata: libraryAddEvent.data,
        channels: ['in_app'],
      });
    });

    it('should handle game removed from library webhook', async () => {
      const libraryRemoveEvent: LibraryEventDto = {
        eventType: 'library.game_removed',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'Old Game',
          removedAt: '2024-01-01T10:00:00Z',
        },
      };

      mockNotificationService.createNotification.mockResolvedValue({
        id: 'notification-126',
        userId: 'user-123',
        type: 'SYSTEM',
        title: 'Игра удалена из библиотеки',
        message: 'Игра "Old Game" была удалена из вашей библиотеки.',
      });

      const response = await request(app.getHttpServer())
        .post('/notifications/webhook/library/game-removed')
        .send(libraryRemoveEvent)
        .expect(HttpStatus.ACCEPTED);

      expect(response.body).toEqual({ status: 'accepted' });
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'system',
        title: 'Игра удалена из библиотеки',
        message: 'Игра "Old Game" была удалена из вашей библиотеки.',
        metadata: libraryRemoveEvent.data,
        channels: ['in_app'],
      });
    });
  });

  describe('Webhook endpoint accessibility', () => {
    it('should allow public access to webhook endpoints', async () => {
      // These endpoints should be accessible without authentication
      const gameUpdateEvent: GameCatalogEventDto = {
        eventType: 'game.updated',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'Test Game',
          updateType: 'patch',
          version: '1.0.1',
        },
      };

      mockNotificationService.createNotification.mockResolvedValue(null);

      // Should not require authentication
      await request(app.getHttpServer())
        .post('/notifications/webhook/game-catalog/updated')
        .send(gameUpdateEvent)
        .expect(HttpStatus.ACCEPTED);

      const libraryEvent: LibraryEventDto = {
        eventType: 'library.game_added',
        userId: 'user-123',
        data: {
          gameId: 'game-456',
          gameName: 'Test Game',
          addedAt: '2024-01-01T10:00:00Z',
        },
      };

      // Should not require authentication
      await request(app.getHttpServer())
        .post('/notifications/webhook/library/game-added')
        .send(libraryEvent)
        .expect(HttpStatus.ACCEPTED);
    });
  });
});
