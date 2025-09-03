import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DlcRepository } from '../../infrastructure/persistence/dlc.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Dlc } from '../../domain/entities/dlc.entity';
import { SeasonPass } from '../../domain/entities/season-pass.entity';
import { SeasonPassDlc } from '../../domain/entities/season-pass-dlc.entity';
import { CreateDlcDto } from '../../infrastructure/http/dtos/create-dlc.dto';
import { UpdateDlcDto } from '../../infrastructure/http/dtos/update-dlc.dto';
import { LibraryServiceIntegration } from '../../infrastructure/integrations/library.service';

@Injectable()
export class DlcService {
  constructor(
    private readonly dlcRepository: DlcRepository,
    private readonly gameRepository: GameRepository,
    @InjectRepository(SeasonPass)
    private readonly seasonPassRepository: Repository<SeasonPass>,
    @InjectRepository(SeasonPassDlc)
    private readonly seasonPassDlcRepository: Repository<SeasonPassDlc>,
    private readonly libraryService: LibraryServiceIntegration,
  ) {}

  async create(createDlcDto: CreateDlcDto): Promise<Dlc> {
    const baseGame = await this.gameRepository.findById(createDlcDto.baseGameId);
    if (!baseGame) {
      throw new NotFoundException(`Base game with ID "${createDlcDto.baseGameId}" not found`);
    }

    const dlc = new Dlc();
    Object.assign(dlc, createDlcDto);
    dlc.baseGame = baseGame;

    return this.dlcRepository.create(dlc);
  }

  async findByGame(gameId: string): Promise<Dlc[]> {
    return this.dlcRepository.findByGameId(gameId);
  }

  async findOne(id: string): Promise<Dlc> {
    const dlc = await this.dlcRepository.findById(id);
    if (!dlc) {
      throw new NotFoundException(`DLC with ID "${id}" not found`);
    }
    return dlc;
  }

  async update(id: string, updateDlcDto: UpdateDlcDto): Promise<Dlc> {
    const dlc = await this.findOne(id);
    Object.assign(dlc, updateDlcDto);
    return this.dlcRepository.save(dlc);
  }

  async remove(id: string): Promise<void> {
    const dlc = await this.findOne(id);
    await this.dlcRepository.remove(dlc);
  }

  // --- Season Pass Methods ---

  async createSeasonPass(gameId: string, name: string, description: string, price: number): Promise<SeasonPass> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found.`);
    }
    const seasonPass = this.seasonPassRepository.create({
      gameId,
      name,
      description,
      price,
    });
    return this.seasonPassRepository.save(seasonPass);
  }

  async addDlcToSeasonPass(seasonPassId: string, dlcId: string): Promise<SeasonPassDlc> {
    const seasonPass = await this.seasonPassRepository.findOneBy({ id: seasonPassId });
    if (!seasonPass) {
      throw new NotFoundException(`SeasonPass with ID "${seasonPassId}" not found.`);
    }
    const dlc = await this.dlcRepository.findById(dlcId);
    if (!dlc) {
      throw new NotFoundException(`DLC with ID "${dlcId}" not found.`);
    }

    const seasonPassDlc = this.seasonPassDlcRepository.create({
      seasonPassId,
      dlcId,
    });
    return this.seasonPassDlcRepository.save(seasonPassDlc);
  }

  async removeDlcFromSeasonPass(seasonPassId: string, dlcId: string): Promise<void> {
    await this.seasonPassDlcRepository.delete({ seasonPassId, dlcId });
  }

  // --- Compatibility Methods ---

  async isDlcCompatible(userId: string, dlcId: string): Promise<boolean> {
    const dlc = await this.dlcRepository.findOne({
      where: { id: dlcId },
      relations: ['compatibleEditions'],
    });

    if (!dlc) {
      throw new NotFoundException(`DLC with ID "${dlcId}" not found.`);
    }

    // If the DLC has no specific compatibility requirements, it's compatible with any edition.
    if (!dlc.compatibleEditions || dlc.compatibleEditions.length === 0) {
      return true;
    }

    const compatibleEditionIds = dlc.compatibleEditions.map(c => c.editionId);
    const ownedEditions = await this.libraryService.getOwnedEditionsForGame(userId, dlc.baseGameId);

    // Check if the user owns at least one of the compatible editions
    return ownedEditions.some(ownedEditionId => compatibleEditionIds.includes(ownedEditionId));
  }
}
