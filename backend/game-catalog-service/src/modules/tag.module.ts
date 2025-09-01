import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from '../domain/entities/tag.entity';
import { TagService } from '../application/services/tag.service';
import { TagController } from '../infrastructure/http/controllers/tag.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  providers: [TagService],
  controllers: [TagController],
})
export class TagModule {}
