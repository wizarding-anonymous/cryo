import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../domain/entities/category.entity';
import { CategoryService } from '../application/services/category.service';
import { CategoryController } from '../infrastructure/http/controllers/category.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  providers: [CategoryService],
  controllers: [CategoryController],
})
export class CategoryModule {}
