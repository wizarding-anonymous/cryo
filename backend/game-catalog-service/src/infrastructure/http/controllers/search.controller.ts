import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from '../../../application/services/search.service';
import { SearchQueryDto } from '../dtos/search-query.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter games using Elasticsearch' })
  @ApiResponse({ status: 200, description: 'An array of game search results.' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query string' })
  @ApiQuery({ name: 'tags', required: false, description: 'Comma-separated list of tags' })
  @ApiQuery({ name: 'categories', required: false, description: 'Comma-separated list of categories' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price', type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by field', enum: ['price', 'releaseDate', 'title'] })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', enum: ['asc', 'desc'] })
  search(@Query() searchQueryDto: SearchQueryDto) {
    return this.searchService.search(searchQueryDto);
  }
}
