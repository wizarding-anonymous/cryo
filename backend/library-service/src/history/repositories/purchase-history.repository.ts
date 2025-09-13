import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseHistory } from '../entities/purchase-history.entity';
import { HistoryQueryDto } from '../dto/request.dto';

@Injectable()
export class PurchaseHistoryRepository extends Repository<PurchaseHistory> {
  constructor(
    @InjectRepository(PurchaseHistory)
    private repository: Repository<PurchaseHistory>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserHistory(
    userId: string,
    queryDto: HistoryQueryDto,
  ): Promise<[PurchaseHistory[], number]> {
    return this.repository.findAndCount({
      where: { userId },
      skip: (queryDto.page - 1) * queryDto.limit,
      take: queryDto.limit,
      order: { [queryDto.sortBy]: queryDto.sortOrder },
    });
  }
}
