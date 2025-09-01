import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

// Mock the entire opossum module
jest.mock('opossum');

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    // Mock CircuitBreaker constructor
    const mockCircuitBreaker = jest.fn().mockImplementation((fn, options) => ({
      fire: fn,
      on: jest.fn(),
    }));

    // Replace the import with our mock
    jest.doMock('opossum', () => mockCircuitBreaker);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CircuitBreakerService,
          useValue: {
            createBreaker: jest.fn().mockImplementation((name, fn) => ({
              fire: fn,
              on: jest.fn(),
            })),
            getBreaker: jest.fn(),
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should create a breaker', () => {
    const fn = async () => {};
    const mockBreaker = { fire: fn, on: jest.fn() };

    (service.createBreaker as jest.Mock).mockReturnValue(mockBreaker);
    (service.getBreaker as jest.Mock).mockReturnValue(mockBreaker);

    const breaker = service.createBreaker('test-breaker', fn);
    expect(breaker).toBeDefined();
    expect(service.getBreaker('test-breaker')).toBe(mockBreaker);
  });

  it('should fire the breaker', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const mockBreaker = { fire: fn, on: jest.fn() };

    (service.createBreaker as jest.Mock).mockReturnValue(mockBreaker);

    const breaker = service.createBreaker('test-breaker', fn);
    const result = await breaker.fire();

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('success');
  });
});
