import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from '../../../application/services/search.service';
import { SearchQueryDto } from '../dtos/search-query.dto';
import { SuggestQueryDto } from '../dtos/suggest-query.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter games using Elasticsearch' })
  @ApiResponse({ status: 200, description: 'An array of game search results.' })
  search(@Query() searchQueryDto: SearchQueryDto) {
    return this.searchService.search(searchQueryDto);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions for a prefix' })
  @ApiResponse({ status: 200, description: 'An array of suggestion strings.' })
  getSuggestions(@Query() suggestQueryDto: SuggestQueryDto) {
    return this.searchService.getSearchSuggestions(suggestQueryDto.prefix);
  }
}
