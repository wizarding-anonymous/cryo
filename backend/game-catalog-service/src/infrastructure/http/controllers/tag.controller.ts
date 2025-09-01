import { Controller, Get, Post, Body } from '@nestjs/common';
import { TagService } from '../../../application/services/tag.service';
import { Tag } from '../../../domain/entities/tag.entity';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  findAll(): Promise<Tag[]> {
    return this.tagService.findAll();
  }

  @Post()
  create(@Body() tagData: Partial<Tag>): Promise<Tag> {
    return this.tagService.create(tagData);
  }
}
