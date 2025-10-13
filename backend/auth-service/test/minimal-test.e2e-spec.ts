import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

describe('Minimal Test', () => {
  let moduleFixture: TestingModule;

  it('should create empty module', async () => {
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [],
        controllers: [],
        providers: [],
      }).compile();
      
      console.log('✓ Empty module created successfully');
      expect(moduleFixture).toBeDefined();
    } catch (error) {
      console.log('✗ Failed to create empty module:', error.message);
      throw error;
    }
  });

  it('should create module with ConfigModule', async () => {
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [() => ({ TEST: 'value' })],
          }),
        ],
        controllers: [],
        providers: [],
      }).compile();
      
      console.log('✓ Module with ConfigModule created successfully');
      expect(moduleFixture).toBeDefined();
    } catch (error) {
      console.log('✗ Failed to create module with ConfigModule:', error.message);
      throw error;
    }
  });

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