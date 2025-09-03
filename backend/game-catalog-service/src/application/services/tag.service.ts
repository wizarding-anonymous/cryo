import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TagRepository } from '../../infrastructure/persistence/tag.repository';
import { Tag } from '../../domain/entities/tag.entity';
import { CreateTagDto } from '../../infrastructure/http/dtos/create-tag.dto';
import { UpdateTagDto } from '../../infrastructure/http/dtos/update-tag.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { generateUniqueSlug } from '../utils/slug.util';

@Injectable()
export class TagService {
  constructor(
    private readonly tagRepository: TagRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const tag = new Tag();
    tag.name = createTagDto.name;

    const slugChecker = (slug: string) => this.tagRepository.findBySlug(slug);
    tag.slug = await generateUniqueSlug(createTagDto.name, slugChecker);

    const newTag = await this.tagRepository.create(tag);
    await this.invalidateCache();
    return newTag;
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

    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      tag.name = updateTagDto.name;
      const slugChecker = (slug: string) => this.tagRepository.findBySlug(slug);
      tag.slug = await generateUniqueSlug(updateTagDto.name, slugChecker);
    }

    const updatedTag = await this.tagRepository.save(tag);
    await this.invalidateCache();
    return updatedTag;
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
    await this.invalidateCache();
  }

  private async invalidateCache() {
    const keys: string[] = await this.cacheManager.store.keys();
    const tagKeys = keys.filter(key => key.startsWith('tag'));
    if (tagKeys.length > 0) {
      await this.cacheManager.store.del(tagKeys);
    }
  }
}
