import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should create a breaker', () => {
    const fn = async () => {};
    const breaker = service.createBreaker('test-breaker', fn);
    expect(breaker).toBeDefined();
    expect(service.getBreaker('test-breaker')).toBe(breaker);
  });

  it('should fire the breaker', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const breaker = service.createBreaker('test-breaker', fn);

    const result = await breaker.fire();

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('success');
  });
});
