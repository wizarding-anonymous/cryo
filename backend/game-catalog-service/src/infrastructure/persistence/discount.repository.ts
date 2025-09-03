import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Discount } from '../../domain/entities/discount.entity';

@Injectable()
export class DiscountRepository extends Repository<Discount> {
  constructor(private dataSource: DataSource) {
    super(Discount, dataSource.createEntityManager());
  }

  // Custom repository methods can be added here in the future
}
