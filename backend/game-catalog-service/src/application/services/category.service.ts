import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CategoryRepository } from '../../infrastructure/persistence/category.repository';
import { Category } from '../../domain/entities/category.entity';
import { CreateCategoryDto } from '../../infrastructure/http/dtos/create-category.dto';
import { UpdateCategoryDto } from '../../infrastructure/http/dtos/update-category.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { generateUniqueSlug } from '../utils/slug.util';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = new Category();
    category.name = createCategoryDto.name;
    category.description = createCategoryDto.description;

    const slugChecker = (slug: string) => this.categoryRepository.findBySlug(slug);
    category.slug = await generateUniqueSlug(createCategoryDto.name, slugChecker);

    const newCategory = await this.categoryRepository.create(category);
    await this.invalidateCache();
    return newCategory;
  }

  async findAll(paginationDto: PaginationDto): Promise<{ data: Category[], total: number }> {
    // This method should be cached, but for simplicity, we'll just invalidate on writes.
    // A proper implementation would use @CacheTTL decorator.
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

    Object.assign(category, updateCategoryDto);

    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const slugChecker = (slug: string) => this.categoryRepository.findBySlug(slug);
      category.slug = await generateUniqueSlug(updateCategoryDto.name, slugChecker);
    }

    const updatedCategory = await this.categoryRepository.save(category);
    await this.invalidateCache();
    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    await this.invalidateCache();
  }

  private async invalidateCache() {
    const keys: string[] = await this.cacheManager.store.keys();
    const categoryKeys = keys.filter(key => key.startsWith('category')); // Be more specific if possible
    if (categoryKeys.length > 0) {
      await this.cacheManager.store.del(categoryKeys);
    }
  }
}
