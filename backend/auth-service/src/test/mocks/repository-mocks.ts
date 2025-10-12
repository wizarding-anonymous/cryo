// Моки для репозиториев

export const createSessionRepositoryMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  }),
});

export const createTokenBlacklistRepositoryMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createLoginAttemptRepositoryMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createSecurityEventRepositoryMock = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

export const createAuthDatabaseServiceMock = () => ({
  getConnection: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
  checkHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    details: { connected: true },
  }),
});

export const createDatabaseServiceMock = () => ({
  checkHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    details: {
      connected: true,
      database: 'auth_db',
      host: 'localhost',
      port: 5432,
      poolStats: {
        totalConnections: 1,
        idleConnections: 1,
        waitingClients: 0,
      },
    },
  }),
});

export const createDatabaseOperationsServiceMock = () => ({
  executeQuery: jest.fn(),
  executeTransaction: jest.fn(),
  checkConnection: jest.fn().mockResolvedValue(true),
});