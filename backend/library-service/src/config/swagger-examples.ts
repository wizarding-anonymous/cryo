/**
 * Comprehensive API examples for Swagger documentation
 * These examples demonstrate common usage patterns and expected responses
 */

export const SwaggerExamples = {
  // Library Examples
  library: {
    userLibrary: {
      summary: 'User library with games',
      description:
        'Example response showing a user library with purchased games',
      value: {
        games: [
          {
            id: '123e4567-e89b-12d3-a456-426614174004',
            gameId: '123e4567-e89b-12d3-a456-426614174001',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            purchaseDate: '2024-01-15T10:30:00Z',
            purchasePrice: 59.99,
            currency: 'RUB',
            orderId: '123e4567-e89b-12d3-a456-426614174002',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              title: 'Cyberpunk 2077',
              developer: 'CD Projekt RED',
              publisher: 'CD Projekt',
              images: [
                'https://example.com/cyberpunk-cover.jpg',
                'https://example.com/cyberpunk-screenshot1.jpg',
              ],
              tags: ['RPG', 'Open World', 'Cyberpunk', 'Action'],
              releaseDate: '2020-12-10T00:00:00Z',
            },
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174005',
            gameId: '123e4567-e89b-12d3-a456-426614174006',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            purchaseDate: '2024-01-10T14:20:00Z',
            purchasePrice: 39.99,
            currency: 'RUB',
            orderId: '123e4567-e89b-12d3-a456-426614174007',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174006',
              title: 'The Witcher 3: Wild Hunt',
              developer: 'CD Projekt RED',
              publisher: 'CD Projekt',
              images: ['https://example.com/witcher3-cover.jpg'],
              tags: ['RPG', 'Fantasy', 'Open World'],
              releaseDate: '2015-05-19T00:00:00Z',
            },
          },
        ],
        pagination: {
          total: 25,
          page: 1,
          limit: 20,
          totalPages: 2,
        },
      },
    },
    emptyLibrary: {
      summary: 'Empty user library',
      description: 'Example response for a user with no games in their library',
      value: {
        games: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      },
    },
    searchResults: {
      summary: 'Search results',
      description: 'Example response for library search with matching games',
      value: {
        games: [
          {
            id: '123e4567-e89b-12d3-a456-426614174004',
            gameId: '123e4567-e89b-12d3-a456-426614174001',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            purchaseDate: '2024-01-15T10:30:00Z',
            purchasePrice: 59.99,
            currency: 'RUB',
            orderId: '123e4567-e89b-12d3-a456-426614174002',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              title: 'Cyberpunk 2077',
              developer: 'CD Projekt RED',
              publisher: 'CD Projekt',
              images: ['https://example.com/cyberpunk-cover.jpg'],
              tags: ['RPG', 'Open World', 'Cyberpunk'],
              releaseDate: '2020-12-10T00:00:00Z',
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  },

  // Ownership Examples
  ownership: {
    owned: {
      summary: 'User owns the game',
      description: 'Example response when user owns the requested game',
      value: {
        owns: true,
        purchaseDate: '2024-01-15T10:30:00Z',
        purchasePrice: 59.99,
        currency: 'RUB',
      },
    },
    notOwned: {
      summary: 'User does not own the game',
      description: 'Example response when user does not own the requested game',
      value: {
        owns: false,
      },
    },
  },

  // Purchase History Examples
  history: {
    purchaseHistory: {
      summary: 'Purchase history with transactions',
      description: 'Example response showing user purchase history',
      value: {
        purchases: [
          {
            id: '123e4567-e89b-12d3-a456-426614174008',
            gameId: '123e4567-e89b-12d3-a456-426614174001',
            orderId: '123e4567-e89b-12d3-a456-426614174002',
            amount: 59.99,
            currency: 'RUB',
            status: 'completed',
            paymentMethod: 'credit_card',
            metadata: {
              transactionId: 'tx_123456789',
              gateway: 'stripe',
              cardLast4: '1234',
              authCode: 'AUTH123456',
            },
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              title: 'Cyberpunk 2077',
              developer: 'CD Projekt RED',
              publisher: 'CD Projekt',
              images: ['https://example.com/cyberpunk-cover.jpg'],
              tags: ['RPG', 'Open World', 'Cyberpunk'],
              releaseDate: '2020-12-10T00:00:00Z',
            },
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174009',
            gameId: '123e4567-e89b-12d3-a456-426614174006',
            orderId: '123e4567-e89b-12d3-a456-426614174010',
            amount: 39.99,
            currency: 'RUB',
            status: 'completed',
            paymentMethod: 'digital_wallet',
            metadata: {
              transactionId: 'tx_987654321',
              gateway: 'yandex_money',
              walletId: 'wallet_456',
            },
            createdAt: '2024-01-10T14:20:00Z',
            updatedAt: '2024-01-10T14:20:00Z',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174006',
              title: 'The Witcher 3: Wild Hunt',
              developer: 'CD Projekt RED',
              publisher: 'CD Projekt',
              images: ['https://example.com/witcher3-cover.jpg'],
              tags: ['RPG', 'Fantasy', 'Open World'],
              releaseDate: '2015-05-19T00:00:00Z',
            },
          },
        ],
        pagination: {
          total: 15,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
    refundedPurchase: {
      summary: 'Purchase history with refunded item',
      description: 'Example showing a refunded purchase in history',
      value: {
        purchases: [
          {
            id: '123e4567-e89b-12d3-a456-426614174011',
            gameId: '123e4567-e89b-12d3-a456-426614174012',
            orderId: '123e4567-e89b-12d3-a456-426614174013',
            amount: 29.99,
            currency: 'RUB',
            status: 'refunded',
            paymentMethod: 'credit_card',
            metadata: {
              transactionId: 'tx_refund_123',
              gateway: 'stripe',
              refundReason: 'customer_request',
              refundDate: '2024-01-20T16:45:00Z',
            },
            createdAt: '2024-01-18T12:00:00Z',
            updatedAt: '2024-01-20T16:45:00Z',
            gameDetails: {
              id: '123e4567-e89b-12d3-a456-426614174012',
              title: 'Example Game',
              developer: 'Example Studio',
              publisher: 'Example Publisher',
              images: ['https://example.com/game-cover.jpg'],
              tags: ['Action', 'Adventure'],
              releaseDate: '2024-01-01T00:00:00Z',
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  },

  // Error Examples
  errors: {
    validation: {
      summary: 'Validation error',
      description: 'Example validation error response',
      value: {
        statusCode: 400,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        correlationId: '123e4567-e89b-12d3-a456-426614174014',
        timestamp: '2024-01-15T10:30:00Z',
        path: '/api/library/my/search',
        details: [
          {
            field: 'query',
            message: 'query must be longer than or equal to 2 characters',
          },
        ],
      },
    },
    unauthorized: {
      summary: 'Unauthorized access',
      description: 'Example unauthorized error response',
      value: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'UNAUTHORIZED',
      },
    },
    gameNotOwned: {
      summary: 'Game not owned',
      description: 'Example error when checking ownership of unowned game',
      value: {
        statusCode: 404,
        message: 'Game not found in user library',
        error: 'NOT_FOUND',
        correlationId: '123e4567-e89b-12d3-a456-426614174015',
        timestamp: '2024-01-15T10:30:00Z',
        path: '/api/library/ownership/123e4567-e89b-12d3-a456-426614174001',
      },
    },
    duplicateGame: {
      summary: 'Duplicate game in library',
      description:
        'Example error when trying to add a game that already exists in library',
      value: {
        statusCode: 409,
        message: 'Game already exists in user library',
        error: 'CONFLICT',
        correlationId: '123e4567-e89b-12d3-a456-426614174016',
        timestamp: '2024-01-15T10:30:00Z',
        path: '/api/library/add',
      },
    },
  },

  // Request Body Examples
  requests: {
    addGameToLibrary: {
      summary: 'Add game to library request',
      description: 'Example request body for adding a game to user library',
      value: {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        purchaseId: '123e4567-e89b-12d3-a456-426614174003',
        purchasePrice: 59.99,
        currency: 'RUB',
        purchaseDate: '2024-01-15T10:30:00Z',
      },
    },
    removeGameFromLibrary: {
      summary: 'Remove game from library request',
      description: 'Example request body for removing a game from user library',
      value: {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
      },
    },
  },
};
