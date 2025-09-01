import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from '../../../application/services/search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') query: string) {
    return this.searchService.search(query);
  }
}
