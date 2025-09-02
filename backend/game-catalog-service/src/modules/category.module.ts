import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../domain/entities/category.entity';
import { CategoryService } from '../application/services/category.service';
import { CategoryController } from '../infrastructure/http/controllers/category.controller';
import { CategoryRepository } from '../infrastructure/persistence/category.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  providers: [CategoryService, CategoryRepository],
  controllers: [CategoryController],
  exports: [CategoryService],
})
export class CategoryModule {}
