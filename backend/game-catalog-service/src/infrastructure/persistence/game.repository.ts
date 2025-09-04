import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { PaginationDto } from '../http/dtos/pagination.dto';

@Injectable()
export class GameRepository {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.gameRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByDeveloper(developerId: string, paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.gameRepository.findAndCount({
      where: { developerId },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByStatus(status: GameStatus, paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.gameRepository.findAndCount({
      where: { status },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<Game | null> {
    return this.gameRepository.findOne({ where: { id }, relations: ['tags', 'categories'] });
  }

  async findBySlug(slug: string): Promise<Game | null> {
    return this.gameRepository.findOne({ where: { slug } });
  }

  async findByIds(ids: string[]): Promise<Game[]> {
    return this.gameRepository.findBy({ id: In(ids) });
  }

  async findSimilar(gameId: string, categoryIds: string[], tagIds: string[], limit: number): Promise<Game[]> {
    if (categoryIds.length === 0 && tagIds.length === 0) {
      return [];
    }

    const queryBuilder = this.gameRepository.createQueryBuilder('game')
      .leftJoinAndSelect('game.tags', 'tag')
      .leftJoinAndSelect('game.categories', 'category')
      .where('game.id != :gameId', { gameId })
      .andWhere('game.status = :status', { status: GameStatus.PUBLISHED });

    if (categoryIds.length > 0) {
      queryBuilder.orWhere('category.id IN (:...categoryIds)', { categoryIds });
    }
    if (tagIds.length > 0) {
      queryBuilder.orWhere('tag.id IN (:...tagIds)', { tagIds });
    }

    return queryBuilder
      .groupBy('game.id')
      .orderBy('COUNT(game.id)', 'DESC')
      .limit(limit)
      .getMany();
  }

  async create(game: Partial<Game>): Promise<Game> {
    const newGame = this.gameRepository.create(game);
    return this.gameRepository.save(newGame);
  }

  async save(game: Game): Promise<Game> {
    return this.gameRepository.save(game);
  }

  async remove(game: Game): Promise<void> {
    await this.gameRepository.remove(game);
  }

  async increment(id: string, field: keyof Game, value: number): Promise<void> {
    await this.gameRepository.increment({ id }, field, value);
  }

  async findPopular(limit: number): Promise<Game[]> {
    // A real implementation would use a better metric for popularity,
    // e.g., sales, reviewsCount, or a dedicated views counter.
    // For now, we'll just sort by reviewsCount as a proxy.
    return this.gameRepository.find({
      where: { status: GameStatus.PUBLISHED },
      order: { reviewsCount: 'DESC' },
      take: limit,
    });
  }

  async findByTagsAndCategories(categoryIds: string[], tagIds: string[], limit: number): Promise<Game[]> {
    if (categoryIds.length === 0 && tagIds.length === 0) {
      return [];
    }

    const queryBuilder = this.gameRepository.createQueryBuilder('game')
      .leftJoin('game.tags', 'tag')
      .leftJoin('game.categories', 'category')
      .where('game.status = :status', { status: GameStatus.PUBLISHED });

    const conditions: string[] = [];
    if (categoryIds.length > 0) {
      conditions.push('category.id IN (:...categoryIds)');
    }
    if (tagIds.length > 0) {
      conditions.push('tag.id IN (:...tagIds)');
    }

    queryBuilder.andWhere(`(${conditions.join(' OR ')})`, { categoryIds, tagIds });

    return queryBuilder
      .groupBy('game.id')
      .orderBy('COUNT(DISTINCT category.id) + COUNT(DISTINCT tag.id)', 'DESC') // Order by number of matched preferences
      .limit(limit)
      .getMany();
  }
}
