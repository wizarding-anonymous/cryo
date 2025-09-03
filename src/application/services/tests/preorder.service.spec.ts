import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PreorderService } from '../preorder.service';
import { Preorder, PreorderStatus } from '../../../domain/entities/preorder.entity';
import { PreorderTier } from '../../../domain/entities/preorder-tier.entity';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { EventPublisherService } from '../event-publisher.service';
import { Repository } from 'typeorm';

const mockPreorderRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
};

const mockTierRepository = {
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockGameRepository = {
  findById: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn(),
};

describe('PreorderService', () => {
  let service: PreorderService;
  let preorderRepo: typeof mockPreorderRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreorderService,
        { provide: getRepositoryToken(Preorder), useValue: mockPreorderRepository },
        { provide: getRepositoryToken(PreorderTier), useValue: mockTierRepository },
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<PreorderService>(PreorderService);
    preorderRepo = module.get(getRepositoryToken(Preorder));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cancel', () => {
    it('should cancel an active preorder before release date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const preorder = { id: '1', status: PreorderStatus.ACTIVE, releaseDate: futureDate };

      preorderRepo.findOne.mockResolvedValue(preorder);
      preorderRepo.save.mockResolvedValue({ ...preorder, status: PreorderStatus.CANCELLED });

      await service.cancel('1');

      expect(preorderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PreorderStatus.CANCELLED }));
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'preorder.cancelled' }));
    });

    it('should throw an error if trying to cancel after release date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const preorder = { id: '1', status: PreorderStatus.ACTIVE, releaseDate: pastDate };

      preorderRepo.findOne.mockResolvedValue(preorder);

      await expect(service.cancel('1')).rejects.toThrow('Cannot cancel a preorder on or after its release date.');
    });
  });

  describe('handleFulfilledPreorders', () => {
    it('should fulfill active preorders that are past their release date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const preordersToFulfill = [
        { id: '1', gameId: 'g1', status: PreorderStatus.ACTIVE, releaseDate: pastDate },
        { id: '2', gameId: 'g2', status: PreorderStatus.ACTIVE, releaseDate: pastDate },
      ];

      preorderRepo.find.mockResolvedValue(preordersToFulfill);
      preorderRepo.save.mockImplementation(p => Promise.resolve(p));

      await service.handleFulfilledPreorders();

      expect(preorderRepo.find).toHaveBeenCalled();
      expect(preorderRepo.save).toHaveBeenCalledTimes(2);
      expect(preorderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: '1', status: PreorderStatus.FULFILLED }));
      expect(preorderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: '2', status: PreorderStatus.FULFILLED }));
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'preorder.fulfilled' }));
    });
  });
});
