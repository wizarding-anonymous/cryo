import { Injectable, NotFoundException } from '@nestjs/common';
import { TagRepository } from '../../infrastructure/persistence/tag.repository';
import { Tag } from '../../domain/entities/tag.entity';
import { CreateTagDto } from '../../infrastructure/http/dtos/create-tag.dto';
import { UpdateTagDto } from '../../infrastructure/http/dtos/update-tag.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';

@Injectable()
export class TagService {
  constructor(private readonly tagRepository: TagRepository) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const tag = new Tag();
    tag.name = createTagDto.name;
    return this.tagRepository.create(tag);
  }

  async findAll(paginationDto: PaginationDto): Promise<{ data: Tag[], total: number }> {
    return this.tagRepository.findAll(paginationDto);
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.tagRepository.findById(id);
    if (!tag) {
      throw new NotFoundException(`Tag with ID "${id}" not found`);
    }
    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);
    tag.name = updateTagDto.name ?? tag.name;
    return this.tagRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
  }
}
