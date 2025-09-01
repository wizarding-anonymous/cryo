import { Controller, Get, Post, Body } from '@nestjs/common';
import { CategoryService } from '../../../application/services/category.service';
import { Category } from '../../../domain/entities/category.entity';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  @Post()
  create(@Body() categoryData: Partial<Category>): Promise<Category> {
    return this.categoryService.create(categoryData);
  }
}
