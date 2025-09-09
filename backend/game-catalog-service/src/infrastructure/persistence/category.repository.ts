import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../domain/entities/category.entity';
import { PaginationDto } from '../http/dtos/pagination.dto';

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<{ data: Category[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.categoryRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<Category | null> {
    return this.categoryRepository.findOneBy({ id });
  }

  async findByIds(ids: string[]): Promise<Category[]> {
    return this.categoryRepository.findBy({ id: In(ids) });
  }

  async create(category: Partial<Category>): Promise<Category> {
    const newCategory = this.categoryRepository.create(category);
    return this.categoryRepository.save(newCategory);
  }

  async save(category: Category): Promise<Category> {
    return this.categoryRepository.save(category);
  }

  async remove(category: Category): Promise<void> {
    await this.categoryRepository.remove(category);
  }
}
