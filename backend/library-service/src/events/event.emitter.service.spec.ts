import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { EventEmitterService } from './event.emitter.service';

describe('EventEmitterService', () => {
  let service: EventEmitterService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'kafka.enabled') {
        return true;
      }
      if (key === 'kafka.broker') {
        return 'localhost:9092';
      }
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventEmitterService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EventEmitterService>(EventEmitterService);

    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(() => of(null)),
    };

    Reflect.set(
      service as unknown as Record<string, unknown>,
      'client',
      mockClient,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitGameAddedEvent', () => {
    it('emits game added event', async () => {
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation();

      await service.emitGameAddedEvent('user123', 'game456');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Emitting game.added event'),
      );
      logSpy.mockRestore();
    });
  });

  describe('emitGameRemovedEvent', () => {
    it('emits game removed event', async () => {
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation();

      await service.emitGameRemovedEvent('user123', 'game456');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Emitting game.removed event'),
      );
      logSpy.mockRestore();
    });
  });

  describe('onModuleInit', () => {
    it('initializes successfully when Kafka connection succeeds', async () => {
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation();

      await service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith('EventEmitterService initialized.');
      logSpy.mockRestore();
    });
  });
});
