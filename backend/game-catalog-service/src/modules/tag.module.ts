import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../domain/entities/tag.entity';
import { TagService } from '../application/services/tag.service';
import { TagController } from '../infrastructure/http/controllers/tag.controller';
import { TagRepository } from '../infrastructure/persistence/tag.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  providers: [TagService, TagRepository],
  controllers: [TagController],
  exports: [TagService],
})
export class TagModule {}
