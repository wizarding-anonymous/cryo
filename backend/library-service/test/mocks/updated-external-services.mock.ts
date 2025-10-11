/**
 * Updated mocks for external services in e2e tests
 * Provides realistic mock implementations that match actual service contracts
 */
import { TEST_USERS } from '../helpers/test-users';

export const createUpdatedUserServiceMock = () => ({
  doesUserExist: jest.fn().mockImplementation(async (userId: string) => {
    // Always return true for any user ID to avoid external calls in tests
    return true;
  }),
  getUserProfile: jest.fn().mockImplementation(async (userId: string) => {
    const user = Object.values(TEST_USERS).find(u => u.id === userId);
    if (user) {
      return {
        id: user.id,
        email: user.email,
        username: user.name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }),
  validateUserToken: jest.fn().mockResolvedValue({ valid: true, userId: TEST_USERS.USER1.id }),
});

export const createUpdatedGameCatalogMock = () => ({
  doesGameExist: jest.fn().mockResolvedValue(true),
  getGamesByIds: jest.fn().mockImplementation((gameIds: string[]) => {
    return Promise.resolve(
      gameIds.map((id, index) => ({
        id,
        title: `Test Game ${index + 1}`,
        developer: `Test Developer ${index + 1}`,
        publisher: `Test Publisher ${index + 1}`,
        images: [`test-image-${index + 1}.jpg`],
        tags: ['action', 'adventure'],
        releaseDate: new Date('2023-01-01'),
        price: 29.99,
        description: `Test game description ${index + 1}`,
      }))
    );
  }),
  getGameDetails: jest.fn().mockImplementation((gameId: string) => {
    return Promise.resolve({
      id: gameId,
      title: 'Test Game',
      developer: 'Test Developer',
      publisher: 'Test Publisher',
      images: ['test-image.jpg'],
      tags: ['action', 'adventure'],
      releaseDate: new Date('2023-01-01'),
      price: 29.99,
      description: 'Test game description',
    });
  }),
});

export const createUpdatedPaymentServiceMock = () => ({
  getOrderStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
  getOrderDetails: jest.fn().mockImplementation((orderId: string) => {
    return Promise.resolve({
      id: orderId,
      userId: TEST_USERS.USER1.id,
      gameId: 'test-game-id',
      amount: 29.99,
      currency: 'USD',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }),
  verifyPayment: jest.fn().mockResolvedValue({
    verified: true,
    transactionId: 'test-transaction-id',
  }),
  getPaymentStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
  validatePurchase: jest.fn().mockResolvedValue(true),
  getPurchaseDetails: jest.fn().mockImplementation((purchaseId: string) => {
    return Promise.resolve({
      id: purchaseId,
      orderId: 'test-order-id',
      userId: TEST_USERS.USER1.id,
      gameId: 'test-game-id',
      amount: 29.99,
      currency: 'USD',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }),
});