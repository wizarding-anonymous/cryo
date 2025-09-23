import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: ':memory:',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
  dropSchema: true,
};

export const testConfig = {
  database: testDatabaseConfig,
  jwt: {
    secret: 'test-jwt-secret-key-for-testing-only',
    expiresIn: '1h',
  },
  redis: {
    host: 'localhost',
    port: 6379,
    password: null,
  },
  services: {
    libraryServiceUrl: 'http://library-service:3000',
    gameCatalogServiceUrl: 'http://game-catalog-service:3000',
  },
  payment: {
    mode: 'simulation',
    autoApprove: true,
    delayMs: 100,
    successRate: 0.95,
  },
};
