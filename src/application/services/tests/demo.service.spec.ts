import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DemoService } from '../demo.service';
import { Demo } from '../../../domain/entities/demo.entity';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { EventPublisherService } from '../event-publisher.service';
import { Repository } from 'typeorm';

const mockDemoRepository = {
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockGameRepository = {
  findById: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn(),
};

describe('DemoService', () => {
  let service: DemoService;
  let repository: typeof mockDemoRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoService,
        { provide: getRepositoryToken(Demo), useValue: mockDemoRepository },
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
    repository = module.get(getRepositoryToken(Demo));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveProgress', () => {
    it('should save the progress for a demo', async () => {
      const demo = { id: '1', progress: {} };
      const progressToSave = { level: 5, score: 1000 };

      repository.findOne.mockResolvedValue(demo);
      repository.save.mockImplementation(d => Promise.resolve(d));

      const result = await service.saveProgress('1', progressToSave);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: ['game'] });
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        progress: progressToSave,
      }));
      expect(result.progress).toEqual(progressToSave);
    });
  });

  describe('completeDemo', () => {
    it('should increment conversion count and publish event if purchased', async () => {
      const demo = { id: '1', gameId: 'g1', conversionCount: 0 };

      repository.findOne.mockResolvedValue(demo);
      repository.save.mockImplementation(d => Promise.resolve(d));

      const result = await service.completeDemo('1', true);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ conversionCount: 1 }));
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        type: 'demo.completed',
        payload: { demoId: '1', gameId: 'g1', purchased: true },
      }));
      expect(result.conversionCount).toBe(1);
    });

    it('should not increment conversion count but still publish event if not purchased', async () => {
        const demo = { id: '1', gameId: 'g1', conversionCount: 5 };

        repository.findOne.mockResolvedValue(demo);
        repository.save.mockImplementation(d => Promise.resolve(d));

        const result = await service.completeDemo('1', false);

        expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ conversionCount: 5 })); // Not incremented
        expect(mockEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
          type: 'demo.completed',
          payload: { demoId: '1', gameId: 'g1', purchased: false },
        }));
        expect(result.conversionCount).toBe(5);
    });
  });
});
