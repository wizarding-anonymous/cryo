/**
 * Base class for E2E tests with proper setup and teardown
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { LibraryGame } from '../src/entities/library-game.entity';
import { PurchaseHistory } from '../src/entities/purchase-history.entity';
import { TestAppModule } from './test-app.module';
import { TEST_USERS, TestUser } from './helpers/test-users';
import { GameCatalogClient } from '../src/clients/game-catalog.client';
import { UserServiceClient } from '../src/clients/user.client';
import { PaymentServiceClient } from '../src/clients/payment-service.client';
import {
    createUpdatedUserServiceMock,
    createUpdatedGameCatalogMock,
    createUpdatedPaymentServiceMock
} from './mocks/updated-external-services.mock';
import { randomUUID } from 'crypto';

// Simple mock manager class
class SimpleMockManager {
    public userServiceClient: any;
    public gameCatalogClient: any;
    public paymentServiceClient: any;
    private testGames: any[] = [];

    constructor() {
        this.userServiceClient = createUpdatedUserServiceMock();
        this.gameCatalogClient = createUpdatedGameCatalogMock();
        this.paymentServiceClient = createUpdatedPaymentServiceMock();
        this.initializeTestGames();
    }

    private initializeTestGames() {
        this.testGames = [
            {
                id: '550e8400-e29b-41d4-a716-446655440001',
                title: 'The Witcher 3: Wild Hunt',
                developer: 'CD Projekt RED',
                publisher: 'CD Projekt',
                images: ['witcher3_cover.jpg'],
                tags: ['RPG', 'Open World', 'Fantasy'],
                releaseDate: new Date('2015-05-19'),
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440002',
                title: 'Cyberpunk 2077',
                developer: 'CD Projekt RED',
                publisher: 'CD Projekt',
                images: ['cyberpunk_cover.jpg'],
                tags: ['RPG', 'Sci-Fi', 'Action'],
                releaseDate: new Date('2020-12-10'),
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440003',
                title: 'Counter-Strike 2',
                developer: 'Valve Corporation',
                publisher: 'Valve Corporation',
                images: ['cs2_cover.jpg'],
                tags: ['FPS', 'Competitive', 'Multiplayer'],
                releaseDate: new Date('2023-09-27'),
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440004',
                title: 'Dota 2',
                developer: 'Valve Corporation',
                publisher: 'Valve Corporation',
                images: ['dota2_cover.jpg'],
                tags: ['MOBA', 'Strategy', 'Multiplayer'],
                releaseDate: new Date('2013-07-09'),
            },
            {
                id: '550e8400-e29b-41d4-a716-446655440005',
                title: 'Red Dead Redemption 2',
                developer: 'Rockstar Games',
                publisher: 'Rockstar Games',
                images: ['rdr2_cover.jpg'],
                tags: ['Action', 'Adventure', 'Open World'],
                releaseDate: new Date('2018-10-26'),
            },
        ];
    }

    getUserServiceMock() { return this.userServiceClient; }
    getGameCatalogMock() { return this.gameCatalogClient; }
    getPaymentServiceMock() { return this.paymentServiceClient; }

    createTestGameId(): string { return this.testGames[0]?.id || randomUUID(); }
    createTestOrderId(): string { return randomUUID(); }
    createTestPurchaseId(): string { return randomUUID(); }

    getTestGame(index: number = 0): any { return this.testGames[index] || this.testGames[0]; }
    getAllTestGames(): any[] { return [...this.testGames]; }

    addTestGame(game: any): void { this.testGames.push(game); }
    addTestOrder(order: any): void {
        // Store test order for mock payment service
        this.paymentServiceClient.getOrderDetails.mockResolvedValue(order);
        this.paymentServiceClient.getOrderStatus.mockResolvedValue({ status: order.status });
    }

    resetAllMocks(): void {
        // Reset and restore original behavior
        this.userServiceClient = createUpdatedUserServiceMock();
        this.gameCatalogClient = createUpdatedGameCatalogMock();
        this.paymentServiceClient = createUpdatedPaymentServiceMock();
    }

    configureGameCatalogFailure(): void {
        this.gameCatalogClient.getGamesByIds.mockRejectedValue(new Error('Game catalog unavailable'));
    }

    restoreNormalBehavior(): void {
        this.gameCatalogClient = createUpdatedGameCatalogMock();
    }
}

export class E2ETestBase {
    public app!: INestApplication;
    public dataSource!: DataSource;
    public jwtService!: JwtService;
    public mockManager!: SimpleMockManager;
    public testUser!: TestUser;
    public validToken!: string;

    public async setupTestApp(): Promise<void> {
        this.mockManager = new SimpleMockManager();

        // Store references to the actual mock objects that will be injected
        const gameCatalogMock = this.mockManager.gameCatalogClient;
        const userServiceMock = this.mockManager.userServiceClient;
        const paymentServiceMock = this.mockManager.paymentServiceClient;

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [TestAppModule],
        })
            .overrideProvider(GameCatalogClient)
            .useValue(gameCatalogMock)
            .overrideProvider(UserServiceClient)
            .useValue(userServiceMock)
            .overrideProvider(PaymentServiceClient)
            .useValue(paymentServiceMock)
            .compile();

        this.app = moduleFixture.createNestApplication();
        this.app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        this.app.setGlobalPrefix('api');
        await this.app.init();

        this.dataSource = this.app.get(DataSource);
        this.jwtService = this.app.get(JwtService);
        this.testUser = TEST_USERS.USER1;

        // Generate valid JWT token
        this.validToken = this.jwtService.sign({
            sub: this.testUser.id,
            username: this.testUser.name,
            email: this.testUser.email,
            roles: ['user'],
        });
    }

    public async teardownTestApp(): Promise<void> {
        if (this.dataSource && this.dataSource.isInitialized) {
            await this.dataSource.destroy();
        }
        if (this.app) {
            await this.app.close();
        }
    }

    public async setup(): Promise<void> {
        await this.setupTestApp();
    }

    public async teardown(): Promise<void> {
        await this.teardownTestApp();
    }

    public async cleanupTestData(userId?: string): Promise<void> {
        // Clean up test data for specific user or all data
        try {
            if (userId) {
                await this.dataSource.getRepository(LibraryGame).delete({ userId });
                await this.dataSource.getRepository(PurchaseHistory).delete({ userId });
            } else {
                await this.dataSource.getRepository(LibraryGame).clear();
                await this.dataSource.getRepository(PurchaseHistory).clear();
            }
        } catch (error) {
            // If clear fails, try alternative approach
            if (userId) {
                await this.dataSource.query('DELETE FROM library_games WHERE "userId" = $1', [userId]);
                await this.dataSource.query('DELETE FROM purchase_history WHERE "userId" = $1', [userId]);
            } else {
                await this.dataSource.query('TRUNCATE TABLE library_games CASCADE');
                await this.dataSource.query('TRUNCATE TABLE purchase_history CASCADE');
            }
        }

        // Reset all mocks
        this.mockManager.resetAllMocks();
    }

    // Convenience getters for accessing mocks
    public get userServiceClient() {
        return this.mockManager.getUserServiceMock();
    }

    public get gameCatalogClient() {
        return this.mockManager.getGameCatalogMock();
    }

    public get paymentServiceClient() {
        return this.mockManager.getPaymentServiceMock();
    }

    public getAuthHeaders(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.validToken}`,
        };
    }

    public async addGameToLibrary(gameData: Partial<any> = {}): Promise<any> {
        const defaultGameData = {
            userId: this.testUser.id,
            gameId: gameData.gameId || this.mockManager.createTestGameId(),
            orderId: this.mockManager.createTestOrderId(),
            purchaseId: this.mockManager.createTestPurchaseId(),
            purchasePrice: 29.99,
            currency: 'USD',
            purchaseDate: new Date().toISOString(),
            ...gameData,
        };

        // Check if game already exists for this user to avoid duplicates
        const existing = await this.dataSource.getRepository(LibraryGame).findOne({
            where: { userId: defaultGameData.userId, gameId: defaultGameData.gameId }
        });

        if (existing) {
            return existing;
        }

        const libraryGame = this.dataSource.getRepository(LibraryGame).create(defaultGameData);
        return await this.dataSource.getRepository(LibraryGame).save(libraryGame);
    }
}