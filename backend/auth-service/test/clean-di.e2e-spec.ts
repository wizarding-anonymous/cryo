import { Test, TestingModule } from '@nestjs/testing';

describe('Clean DI Test (no setup)', () => {
  let moduleFixture: TestingModule;

  it('should create module with simple provider', async () => {
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [],
        controllers: [],
        providers: [
          {
            provide: 'TEST_SERVICE',
            useValue: { test: 'value' },
          },
        ],
      }).compile();
      
      const testService = moduleFixture.get('TEST_SERVICE');
      console.log('✓ Module with simple provider created successfully');
      console.log('✓ Test service retrieved:', testService);
      expect(moduleFixture).toBeDefined();
      expect(testService).toBeDefined();
      expect(testService.test).toBe('value');
    } catch (error) {
      console.log('✗ Failed to create module with simple provider:', error.message);
      throw error;
    }
  });

  afterEach(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });
});