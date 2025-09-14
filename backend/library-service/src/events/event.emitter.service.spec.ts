import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitterService } from './event.emitter.service';

describe('EventEmitterService', () => {
  let service: EventEmitterService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventEmitterService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EventEmitterService>(EventEmitterService);
    
    // Mock the client property
    service['client'] = {
      emit: jest.fn(),
    } as any;
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitGameAddedEvent', () => {
    it('should emit game added event', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      
      await service.emitGameAddedEvent('user123', 'game456');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Emitting game.added event')
      );
      
      logSpy.mockRestore();
    });
  });

  describe('emitGameRemovedEvent', () => {
    it('should emit game removed event', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      
      await service.emitGameRemovedEvent('user123', 'game456');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Emitting game.removed event')
      );
      
      logSpy.mockRestore();
    });
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      
      await service.onModuleInit();
      
      expect(logSpy).toHaveBeenCalledWith('EventEmitterService initialized.');
      
      logSpy.mockRestore();
    });
  });
});