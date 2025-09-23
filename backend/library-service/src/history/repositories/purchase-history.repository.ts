import { Injectable } from '@nestjs/common';
import { Repository, type FindOptionsOrder, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto, HistorySortBy } from '../dto/request.dto';

interface NormalizedHistoryQuery {
  page: number;
  limit: number;
  sortBy: HistorySortBy;
  sortOrder: 'asc' | 'desc';
}

export interface HistoryFilterOptions {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  gameId?: string;
  orderId?: string;
}

@Injectable()
export class PurchaseHistoryRepository extends Repository<PurchaseHistory> {
  constructor(
    @InjectRepository(PurchaseHistory)
    private readonly repository: Repository<PurchaseHistory>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserHistory(
    userId: string,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder = queryDto.sortOrder ?? 'desc';

    const orderDirection: 'ASC' | 'DESC' = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order: FindOptionsOrder<PurchaseHistory> = {
      [sortBy]: orderDirection,
    } as FindOptionsOrder<PurchaseHistory>;

    return this.repository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order,
    });
  }

  async findUserHistoryWithFilters(
    userId: string,
    queryDto: HistoryQueryDto | NormalizedHistoryQuery,
    filters: HistoryFilterOptions = {},
  ): Promise<[PurchaseHistory[], number]> {
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const sortBy = queryDto.sortBy ?? HistorySortBy.CREATED_AT;
    const sortOrder = (queryDto.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let qb: SelectQueryBuilder<PurchaseHistory> = this.repository
      .createQueryBuilder('ph')
      .where('ph."userId" = :userId', { userId });

    if (filters.status) {
      qb = qb.andWhere('ph."status" = :status', { status: filters.status });
    }
    if (filters.dateFrom) {
      qb = qb.andWhere('ph."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb = qb.andWhere('ph."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    if (typeof filters.minAmount === 'number') {
      qb = qb.andWhere('ph."amount" >= :minAmount', { minAmount: filters.minAmount });
    }
    if (typeof filters.maxAmount === 'number') {
      qb = qb.andWhere('ph."amount" <= :maxAmount', { maxAmount: filters.maxAmount });
    }
    if (filters.gameId) {
      qb = qb.andWhere('ph."gameId" = :gameId', { gameId: filters.gameId });
    }
    if (filters.orderId) {
      qb = qb.andWhere('ph."orderId" = :orderId', { orderId: filters.orderId });
    }

    qb = qb.orderBy(`ph."${sortBy}"`, sortOrder as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, count] = await qb.getManyAndCount();
    return [rows, count];
  }
}
