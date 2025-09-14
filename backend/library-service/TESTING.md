# Testing Guide for Library Service

## 🧪 Test Types

### Unit Tests
- **Location**: `src/**/*.spec.ts`
- **Database**: Mocked repositories
- **Cache**: Mocked cache service
- **External APIs**: Mocked HTTP clients

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### E2E Tests
- **Location**: `test/**/*.e2e-spec.ts`
- **Database**: SQLite in-memory (fast, isolated)
- **Cache**: Memory cache (no Redis dependency)
- **External APIs**: Mocked services

```bash
# Run E2E tests (uses in-memory SQLite)
npm run test:e2e

# Run E2E tests with coverage
npm run test:e2e:cov

# Run E2E tests with Docker test services
npm run test:e2e:docker
```

## 🗄️ Database Configuration

### Development Database
- **Host**: localhost:5436
- **Database**: library_service
- **Type**: PostgreSQL 14+
- **Data**: Persistent (docker volume)

### Test Database (E2E)
- **Type**: SQLite in-memory
- **Database**: `:memory:`
- **Data**: Temporary (recreated for each test)
- **Speed**: Very fast
- **Isolation**: Complete isolation between tests

### Test Database (Docker - Optional)
- **Host**: localhost:5437
- **Database**: library_service_test
- **Type**: PostgreSQL 14+
- **Data**: Temporary (tmpfs for speed)

## 🚀 Running Tests

### Quick Tests (Recommended)
```bash
# Unit tests only (fastest)
npm run test

# E2E tests with in-memory database (fast)
npm run test:e2e

# All tests
npm run test:all
```

### Full Integration Tests
```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests against real PostgreSQL
NODE_ENV=test DATABASE_PORT=5437 npm run test:e2e

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## 🔧 Test Configuration

### Environment Variables (Test)
```bash
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5437  # Test database port
DATABASE_NAME=library_service_test
REDIS_PORT=6382     # Test Redis port
KAFKA_ENABLED=false # Disable Kafka for tests
JWT_SECRET=test-secret-key
```

### Test Module Configuration
- **Database**: SQLite in-memory for speed
- **Cache**: Memory cache instead of Redis
- **External Services**: Mocked HTTP clients
- **Kafka**: Disabled
- **Logging**: Minimal

## 📊 Coverage Requirements

### Current Coverage
- **Statements**: 43.63%
- **Branches**: 31.84%
- **Functions**: 36.29%
- **Lines**: 43.88%

### Target Coverage
- **Statements**: 100%
- **Branches**: 90%
- **Functions**: 100%
- **Lines**: 100%

## 🐛 Troubleshooting

### E2E Tests Fail with Database Connection
- **Solution**: Tests now use SQLite in-memory, no external database needed
- **Alternative**: Use `npm run test:e2e:docker` for PostgreSQL tests

### Unit Tests Fail with Mock Issues
- **Check**: Mock implementations in test files
- **Fix**: Update mocks to match service interfaces

### Kafka Connection Errors
- **Solution**: Kafka is now disabled in test environment
- **Check**: `KAFKA_ENABLED=false` in test setup

### Cache Service Errors
- **Solution**: Tests use memory cache instead of Redis
- **Check**: Test module configuration

## 📝 Writing Tests

### Unit Test Example
```typescript
describe('LibraryService', () => {
  let service: LibraryService;
  let mockRepository: jest.Mocked<LibraryRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LibraryService,
        {
          provide: LibraryRepository,
          useValue: {
            findUserLibrary: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
    mockRepository = module.get(LibraryRepository);
  });

  it('should return user library', async () => {
    // Test implementation
  });
});
```

### E2E Test Example
```typescript
describe('Library API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TestAppModule], // Uses SQLite in-memory
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/library/my (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/library/my')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
  });
});
```

## 🎯 Best Practices

1. **Isolation**: Each test should be independent
2. **Speed**: Use in-memory databases for E2E tests
3. **Mocking**: Mock external dependencies in unit tests
4. **Coverage**: Aim for high test coverage
5. **Cleanup**: Always clean up resources after tests
6. **Environment**: Use separate test environment configuration