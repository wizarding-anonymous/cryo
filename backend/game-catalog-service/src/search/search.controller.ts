import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchGamesDto } from '../dto/search-games.dto';
import { GameListResponse } from '../interfaces/game.interface';
import { HttpCacheInterceptor } from '../common/interceptors/http-cache.interceptor';
import { Game } from '../entities/game.entity';

@ApiTags('Search')
@Controller('search')
@UseInterceptors(HttpCacheInterceptor)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search for games' })
  @ApiResponse({ status: 200, description: 'A paginated list of games matching the search criteria.', type: [Game] })
  async searchGames(
    @Query() searchGamesDto: SearchGamesDto,
  ): Promise<GameListResponse> {
    return this.searchService.searchGames(searchGamesDto);
  }
}
