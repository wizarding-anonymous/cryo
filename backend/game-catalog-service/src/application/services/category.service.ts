import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryRepository } from '../../infrastructure/persistence/category.repository';
import { Category } from '../../domain/entities/category.entity';
import { CreateCategoryDto } from '../../infrastructure/http/dtos/create-category.dto';
import { UpdateCategoryDto } from '../../infrastructure/http/dtos/update-category.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = new Category();
    category.name = createCategoryDto.name;
    category.description = createCategoryDto.description;
    // This slug generation should be improved with the same unique generator as in GameService
    category.slug = createCategoryDto.name.toLowerCase().replace(/ /g, '-');
    return this.categoryRepository.create(category);
  }

  async findAll(paginationDto: PaginationDto): Promise<{ data: Category[], total: number }> {
    return this.categoryRepository.findAll(paginationDto);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    // Using Object.assign for partial updates
    Object.assign(category, updateCategoryDto);

    if (updateCategoryDto.name) {
        // This slug generation should be improved with the same unique generator as in GameService
        category.slug = updateCategoryDto.name.toLowerCase().replace(/ /g, '-');
    }
    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }
}
