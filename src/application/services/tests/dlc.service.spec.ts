import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DlcService } from '../dlc.service';
import { DlcRepository } from '../../../infrastructure/persistence/dlc.repository';
import { GameRepository } from '../../../infrastructure/persistence/game.repository';
import { SeasonPass } from '../../../domain/entities/season-pass.entity';
import { SeasonPassDlc } from '../../../domain/entities/season-pass-dlc.entity';
import { LibraryServiceIntegration } from '../../../infrastructure/integrations/library.service';
import { Dlc } from '../../../domain/entities/dlc.entity';

const mockDlcRepository = {
  findOne: jest.fn(),
};
const mockGameRepository = {};
const mockSeasonPassRepository = {};
const mockSeasonPassDlcRepository = {};
const mockLibraryService = {
  getOwnedEditionsForGame: jest.fn(),
};

describe('DlcService', () => {
  let service: DlcService;
  let dlcRepository: typeof mockDlcRepository;
  let libraryService: LibraryServiceIntegration;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlcService,
        { provide: DlcRepository, useValue: mockDlcRepository },
        { provide: GameRepository, useValue: mockGameRepository },
        { provide: getRepositoryToken(SeasonPass), useValue: mockSeasonPassRepository },
        { provide: getRepositoryToken(SeasonPassDlc), useValue: mockSeasonPassDlcRepository },
        { provide: LibraryServiceIntegration, useValue: mockLibraryService },
      ],
    }).compile();

    service = module.get<DlcService>(DlcService);
    dlcRepository = module.get(DlcRepository);
    libraryService = module.get<LibraryServiceIntegration>(LibraryServiceIntegration);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isDlcCompatible', () => {
    it('should return true if user owns a compatible edition', async () => {
      const dlc = {
        id: 'dlc1',
        baseGameId: 'g1',
        compatibleEditions: [{ editionId: 'deluxe' }, { editionId: 'ultimate' }]
      } as any;

      dlcRepository.findOne.mockResolvedValue(dlc);
      mockLibraryService.getOwnedEditionsForGame.mockResolvedValue(['standard', 'deluxe']);

      const isCompatible = await service.isDlcCompatible('user1', 'dlc1');

      expect(isCompatible).toBe(true);
      expect(libraryService.getOwnedEditionsForGame).toHaveBeenCalledWith('user1', 'g1');
    });

    it('should return false if user does not own a compatible edition', async () => {
        const dlc = {
            id: 'dlc1',
            baseGameId: 'g1',
            compatibleEditions: [{ editionId: 'deluxe' }]
          } as any;

          dlcRepository.findOne.mockResolvedValue(dlc);
          mockLibraryService.getOwnedEditionsForGame.mockResolvedValue(['standard']);

          const isCompatible = await service.isDlcCompatible('user1', 'dlc1');

          expect(isCompatible).toBe(false);
    });

    it('should return true if DLC has no specific compatibility requirements', async () => {
        const dlc = {
            id: 'dlc1',
            baseGameId: 'g1',
            compatibleEditions: [] // No requirements
          } as any;

        dlcRepository.findOne.mockResolvedValue(dlc);

        const isCompatible = await service.isDlcCompatible('user1', 'dlc1');

        expect(isCompatible).toBe(true);
        expect(libraryService.getOwnedEditionsForGame).not.toHaveBeenCalled();
      });
  });
});
