import { Injectable } from '@nestjs/common';
import { Repository, type FindOptionsOrder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LibraryGame } from '../entities/library-game.entity';
import { LibraryQueryDto, SortBy } from '../dto/request.dto';

interface NormalizedQuery {
  page: number;
  limit: number;
  sortBy: SortBy;
  sortOrder: 'asc' | 'desc';
}

const sortColumnMap: Record<SortBy, keyof LibraryGame> = {
  [SortBy.PURCHASE_DATE]: 'purchaseDate',
  [SortBy.TITLE]: 'gameId',
  [SortBy.DEVELOPER]: 'gameId',
  [SortBy.PRICE]: 'purchasePrice',
};

@Injectable()
export class LibraryRepository extends Repository<LibraryGame> {
  constructor(
    @InjectRepository(LibraryGame)
    private readonly repository: Repository<LibraryGame>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<[LibraryGame[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order: FindOptionsOrder<LibraryGame> = {
      [sortColumn]: orderDirection,
    } as FindOptionsOrder<LibraryGame>;

    return this.repository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order,
    });
  }

  async findOneByUserIdAndGameId(
    userId: string,
    gameId: string,
  ): Promise<LibraryGame | null> {
    return this.repository.findOne({ where: { userId, gameId } });
  }
}
