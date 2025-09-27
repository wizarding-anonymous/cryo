import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { GameCatalogIntegrationService } from '../integrations/game-catalog/game-catalog.service';
import { LibraryIntegrationService } from '../integrations/library/library.service';
import { JwtService } from '@nestjs/jwt';
import { GamePurchaseInfo } from '../integrations/game-catalog/dto/game-purchase-info.dto';
import { PaymentProvider } from '../common/enums/payment-provider.enum';

describe('Happy Path (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let gameCatalogService: GameCatalogIntegrationService;
  let libraryService: LibraryIntegrationService;

  const mockGameInfo: GamePurchaseInfo = {
    id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    title: 'Test E2E Game',
    price: 1299,
    currency: 'RUB',
    available: true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GameCatalogIntegrationService)
      .useValue({
        getGamePurchaseInfo: jest.fn().mockResolvedValue(mockGameInfo),
      })
      .overrideProvider(LibraryIntegrationService)
      .useValue({ addGameToLibrary: jest.fn().mockResolvedValue(true) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    gameCatalogService = moduleFixture.get<GameCatalogIntegrationService>(
      GameCatalogIntegrationService,
    );
    libraryService = moduleFixture.get<LibraryIntegrationService>(
      LibraryIntegrationService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully process a full order -> payment -> library flow', async () => {
    const token = jwtService.sign({ sub: 'e2e-user-id', username: 'e2e-user' });

    // 1. Create an order
    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: mockGameInfo.id })
      .expect(201);

    const orderId = orderResponse.body.id;
    expect(orderId).toBeDefined();

    // 2. Create a payment for the order
    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId, provider: PaymentProvider.SBERBANK })
      .expect(201);

    const paymentId = paymentResponse.body.id;
    expect(paymentId).toBeDefined();

    // 3. Process the payment to get the (mock) URL
    await request(app.getHttpServer())
      .post(`/payments/${paymentId}/process`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    // 4. Simulate a successful webhook callback
    const externalId = 'mock-external-id-from-webhook'; // In a real test, we might get this from the process step

    // First, let's update our payment with the externalId, as the provider would have done
    // This is a simplification for the test, as we don't have the real provider flow.
    const paymentRepo = app.get('PaymentRepository');
    await paymentRepo.update(paymentId, { externalId });

    await request(app.getHttpServer())
      .post(`/webhooks/${PaymentProvider.SBERBANK}`)
      .send({ externalId, status: 'success' })
      .expect(200);

    // 5. Verify that the library service was called
    expect(libraryService.addGameToLibrary).toHaveBeenCalled();
    expect(libraryService.addGameToLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'e2e-user-id',
        gameId: mockGameInfo.id,
        orderId: orderId,
      }),
    );
  });
});
