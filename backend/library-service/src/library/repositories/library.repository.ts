import { Injectable } from '@nestjs/common';
import { Repository, type FindOptionsOrder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LibraryGame } from '../entities/library-game.entity';
import { LibraryQueryDto, SortBy } from '../dto/request.dto';
import { PurchaseHistory } from '../../history/entities/purchase-history.entity';

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

  /**
   * Returns library items joined with the latest purchase information per game for the given user.
   * Uses a lateral join via subquery to fetch the most recent purchase row.
   */
  async findUserLibraryWithLatestPurchase(
    userId: string,
    queryDto: LibraryQueryDto | NormalizedQuery,
  ): Promise<
    [
      Array<
        LibraryGame & {
          latestPurchaseId: string | null;
          latestPurchaseStatus: string | null;
          latestPurchaseCreatedAt: Date | null;
        }
      >,
      number
    ]
  > {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? SortBy.PURCHASE_DATE;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const sortColumn = sortColumnMap[sortBy] ?? 'purchaseDate';
    const orderDirection: 'ASC' | 'DESC' = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repository
      .createQueryBuilder('lg')
      .leftJoin(
        (qb) =>
          qb
            .from(PurchaseHistory, 'ph')
            .select('ph.id', 'id')
            .addSelect('ph.status', 'status')
            .addSelect('ph.createdAt', 'createdAt')
            .where('ph."userId" = lg."userId"')
            .andWhere('ph."gameId" = lg."gameId"')
            .orderBy('ph."createdAt"', 'DESC')
            .limit(1),
        'latest_ph',
        '1=1',
      )
      .where('lg."userId" = :userId', { userId })
      .orderBy(`lg."${sortColumn}"`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'lg.id as id',
        'lg.userId as userId',
        'lg.gameId as gameId',
        'lg.purchaseDate as purchaseDate',
        'lg.purchasePrice as purchasePrice',
        'lg.currency as currency',
        'lg.orderId as orderId',
        'lg.purchaseId as purchaseId',
        'latest_ph.id as latestPurchaseId',
        'latest_ph.status as latestPurchaseStatus',
        'latest_ph.createdAt as latestPurchaseCreatedAt',
      ]);

    const [rows, count] = await Promise.all([
      qb.getRawMany<
        LibraryGame & {
          latestPurchaseId: string | null;
          latestPurchaseStatus: string | null;
          latestPurchaseCreatedAt: Date | null;
        }
      >(),
      this.repository.count({ where: { userId } }),
    ]);

    return [rows, count];
  }
}
