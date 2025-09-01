import { Controller, Get, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { SearchService } from '../../../application/services/search.service';
import { SearchQueryDto } from '../dtos/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  search(@Query() searchQueryDto: SearchQueryDto) {
    return this.searchService.search(searchQueryDto);
  }
}
