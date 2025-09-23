import { Injectable } from '@nestjs/common';
import { Repository, type FindOptionsOrder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto, HistorySortBy } from '../dto/request.dto';

interface NormalizedHistoryQuery {
  page: number;
  limit: number;
  sortBy: HistorySortBy;
  sortOrder: 'asc' | 'desc';
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
}
