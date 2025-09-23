import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';
import { CacheTTL } from '@nestjs/cache-manager';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import {
  LibraryQueryDto,
  SearchLibraryDto,
  AddGameToLibraryDto,
  RemoveGameFromLibraryDto,
  LibraryResponseDto,
  OwnershipResponseDto,
  LibraryGameDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

// Define a type for authenticated requests
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    roles: string[];
  };
}

@ApiTags('Library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly searchService: SearchService,
  ) {}

  @Get('my')
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiOperation({
    summary: 'Get user library',
    description:
      "Retrieve the authenticated user's game library with pagination and sorting options",
  })
  @ApiResponse({
    status: 200,
    description: 'User library retrieved successfully',
    type: LibraryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have access to this library',
  })
  async getMyLibrary(
    @Req() request: AuthenticatedRequest,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    const userId = request.user.id;
    return this.libraryService.getUserLibrary(userId, query);
  }

  @Get('my/search')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120) // 2 minutes for search results
  @ApiOperation({
    summary: 'Search in user library',
    description:
      "Search games in the authenticated user's library by title, developer, or tags",
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: LibraryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid search parameters',
  })
  async searchMyLibrary(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchLibraryDto,
  ): Promise<LibraryResponseDto> {
    const userId = request.user.id;
    return this.searchService.searchUserLibrary(userId, query);
  }

  @Get('ownership/:gameId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Check game ownership',
    description: 'Check if the authenticated user owns a specific game',
  })
  @ApiResponse({
    status: 200,
    description: 'Ownership status retrieved successfully',
    type: OwnershipResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found in user library',
  })
  async checkOwnership(
    @Req() request: AuthenticatedRequest,
    @Param('gameId') gameId: string,
  ): Promise<OwnershipResponseDto> {
    const userId = request.user.id;
    return this.libraryService.checkGameOwnership(userId, gameId);
  }

  // --- Internal Endpoints --- //
  // These endpoints are for service-to-service communication only

  @Post('add')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary: 'Add game to library (internal)',
    description:
      'Internal endpoint to add a game to user library after purchase confirmation',
  })
  @ApiResponse({
    status: 201,
    description: 'Game added to library successfully',
    type: LibraryGameDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid game or user data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal authentication',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Game already exists in library',
  })
  async addGameToLibrary(
    @Body() dto: AddGameToLibraryDto,
  ): Promise<LibraryGameDto> {
    const libraryGame = await this.libraryService.addGameToLibrary(dto);
    return LibraryGameDto.fromEntity(libraryGame);
  }

  @Delete('remove')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary: 'Remove game from library (internal)',
    description:
      'Internal endpoint to remove a game from user library (e.g., for refunds)',
  })
  @ApiResponse({
    status: 200,
    description: 'Game removed from library successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal authentication',
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found in user library',
  })
  async removeGameFromLibrary(
    @Body() dto: RemoveGameFromLibraryDto,
  ): Promise<void> {
    return this.libraryService.removeGameFromLibrary(dto.userId, dto.gameId);
  }

  // Internal endpoint for other services (e.g., Download Service)
  @Get('user/:userId/games')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary: 'Get games for a specific user (internal)',
    description:
      'Internal endpoint to retrieve games for a specific user (used by Download Service, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'User games retrieved successfully',
    type: LibraryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal authentication',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserGamesInternal(
    @Param('userId') userId: string,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    return this.libraryService.getUserLibrary(userId, query);
  }
}
