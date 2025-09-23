import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationController } from './integration.controller';
import { EventService } from '../services/event.service';

describe('IntegrationController', () => {
    let controller: IntegrationController;
    let eventService: EventService;

    const mockEventService = {
        handleGamePurchase: jest.fn(),
        handleReviewCreated: jest.fn(),
        handleFriendAdded: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [IntegrationController],
            providers: [
                {
                    provide: EventService,
                    useValue: mockEventService,
                },
            ],
        }).compile();

        controller = module.get<IntegrationController>(IntegrationController);
        eventService = module.get<EventService>(EventService);

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('handlePaymentPurchase', () => {
        it('should handle payment purchase event successfully', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                transactionId: 'tx-123',
                amount: 1999,
                currency: 'RUB',
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            mockEventService.handleGamePurchase.mockResolvedValue(undefined);

            const result = await controller.handlePaymentPurchase(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Payment purchase event processed successfully',
            });

            expect(eventService.handleGamePurchase).toHaveBeenCalledWith(
                eventData.userId,
                eventData.gameId
            );
        });

        it('should throw error when event processing fails', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                transactionId: 'tx-123',
                amount: 1999,
                currency: 'RUB',
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const error = new Error('Processing failed');
            mockEventService.handleGamePurchase.mockRejectedValue(error);

            await expect(controller.handlePaymentPurchase(eventData)).rejects.toThrow(error);

            expect(eventService.handleGamePurchase).toHaveBeenCalledWith(
                eventData.userId,
                eventData.gameId
            );
        });
    });

    describe('handleReviewCreated', () => {
        it('should handle review created event successfully', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                reviewId: '123e4567-e89b-12d3-a456-426614174002',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                rating: 5,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            mockEventService.handleReviewCreated.mockResolvedValue(undefined);

            const result = await controller.handleReviewCreated(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Review created event processed successfully',
            });

            expect(eventService.handleReviewCreated).toHaveBeenCalledWith(
                eventData.userId,
                eventData.reviewId
            );
        });

        it('should throw error when event processing fails', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                reviewId: '123e4567-e89b-12d3-a456-426614174002',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                rating: 5,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const error = new Error('Processing failed');
            mockEventService.handleReviewCreated.mockRejectedValue(error);

            await expect(controller.handleReviewCreated(eventData)).rejects.toThrow(error);

            expect(eventService.handleReviewCreated).toHaveBeenCalledWith(
                eventData.userId,
                eventData.reviewId
            );
        });
    });

    describe('handleSocialEvent', () => {
        it('should handle friend added event successfully', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                friendId: '123e4567-e89b-12d3-a456-426614174003',
                eventType: 'friend_added' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            mockEventService.handleFriendAdded.mockResolvedValue(undefined);

            const result = await controller.handleSocialEvent(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Social event processed successfully',
            });

            expect(eventService.handleFriendAdded).toHaveBeenCalledWith(
                eventData.userId,
                eventData.friendId
            );
        });

        it('should ignore friend removed events', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                friendId: '123e4567-e89b-12d3-a456-426614174003',
                eventType: 'friend_removed' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const result = await controller.handleSocialEvent(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Social event processed successfully',
            });

            expect(eventService.handleFriendAdded).not.toHaveBeenCalled();
        });

        it('should throw error when friend added processing fails', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                friendId: '123e4567-e89b-12d3-a456-426614174003',
                eventType: 'friend_added' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const error = new Error('Processing failed');
            mockEventService.handleFriendAdded.mockRejectedValue(error);

            await expect(controller.handleSocialEvent(eventData)).rejects.toThrow(error);

            expect(eventService.handleFriendAdded).toHaveBeenCalledWith(
                eventData.userId,
                eventData.friendId
            );
        });
    });

    describe('handleLibraryUpdate', () => {
        it('should handle library game added event successfully', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                action: 'added' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            mockEventService.handleGamePurchase.mockResolvedValue(undefined);

            const result = await controller.handleLibraryUpdate(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Library update event processed successfully',
            });

            expect(eventService.handleGamePurchase).toHaveBeenCalledWith(
                eventData.userId,
                eventData.gameId
            );
        });

        it('should ignore library game removed events', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                action: 'removed' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const result = await controller.handleLibraryUpdate(eventData);

            expect(result).toEqual({
                success: true,
                message: 'Library update event processed successfully',
            });

            expect(eventService.handleGamePurchase).not.toHaveBeenCalled();
        });

        it('should throw error when library update processing fails', async () => {
            const eventData = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                gameId: '123e4567-e89b-12d3-a456-426614174001',
                action: 'added' as const,
                timestamp: '2024-01-01T00:00:00.000Z',
            };

            const error = new Error('Processing failed');
            mockEventService.handleGamePurchase.mockRejectedValue(error);

            await expect(controller.handleLibraryUpdate(eventData)).rejects.toThrow(error);

            expect(eventService.handleGamePurchase).toHaveBeenCalledWith(
                eventData.userId,
                eventData.gameId
            );
        });
    });

    describe('healthCheck', () => {
        it('should return health status', async () => {
            const result = await controller.healthCheck();

            expect(result).toHaveProperty('status', 'healthy');
            expect(result).toHaveProperty('timestamp');
            expect(typeof result.timestamp).toBe('string');
        });

        it('should return current timestamp', async () => {
            const beforeCall = new Date();
            const result = await controller.healthCheck();
            const afterCall = new Date();

            const resultTimestamp = new Date(result.timestamp);
            expect(resultTimestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
            expect(resultTimestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
        });
    });
});