import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TagService } from '../../../application/services/tag.service';
import { Tag } from '../../../domain/entities/tag.entity';
import { CreateTagDto } from '../dtos/create-tag.dto';
import { UpdateTagDto } from '../dtos/update-tag.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Tags')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({ status: 201, description: 'The tag has been successfully created.', type: Tag })
  create(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    return this.tagService.create(createTagDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a paginated list of tags' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiResponse({ status: 200, description: 'A paginated list of tags.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.tagService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single tag by ID' })
  @ApiResponse({ status: 200, description: 'The tag object.', type: Tag })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  findOne(@Param('id') id: string): Promise<Tag> {
    return this.tagService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, description: 'The tag has been successfully updated.', type: Tag })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  update(@Param('id') id: string, @Body() updateTagDto: UpdateTagDto): Promise<Tag> {
    return this.tagService.update(id, updateTagDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 204, description: 'The tag has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Tag not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.tagService.remove(id);
  }
}
