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
  ApiParam,
  ApiQuery,
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
import {
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
  ForbiddenErrorResponseDto,
  NotFoundErrorResponseDto,
  ConflictErrorResponseDto,
  InternalServerErrorResponseDto,
} from '../common/dto';
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
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: 'number',
    example: 20,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['purchaseDate', 'title', 'developer', 'price'],
    example: 'purchaseDate',
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiOperation({
    summary: 'Get user library',
    description: `Retrieve the authenticated user's game library with pagination and sorting options.
    
**Features:**
- Paginated results with configurable page size
- Multiple sorting options (purchase date, title, developer, price)
- Cached responses for improved performance
- Enriched with game details from catalog service

**Example Usage:**
- Get first page: \`GET /api/library/my\`
- Get specific page: \`GET /api/library/my?page=2&limit=10\`
- Sort by title: \`GET /api/library/my?sortBy=title&sortOrder=asc\``,
  })
  @ApiResponse({
    status: 200,
    description: 'User library retrieved successfully',
    type: LibraryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have access to this library',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
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
  @ApiQuery({
    name: 'query',
    description: 'Search query string (minimum 2 characters)',
    required: true,
    type: 'string',
    example: 'cyberpunk',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: 'number',
    example: 20,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['purchaseDate', 'title', 'developer', 'price'],
    example: 'purchaseDate',
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiOperation({
    summary: 'Search in user library',
    description: `Search games in the authenticated user's library by title, developer, or tags.
    
**Search Features:**
- Full-text search across game titles, developers, and tags
- Fuzzy matching for typos and partial matches
- Case-insensitive search
- Supports pagination and sorting of results

**Example Searches:**
- By title: \`GET /api/library/my/search?query=cyberpunk\`
- By developer: \`GET /api/library/my/search?query=cd projekt\`
- Partial match: \`GET /api/library/my/search?query=cyber\``,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: LibraryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid search parameters',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
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
  @ApiParam({
    name: 'gameId',
    description: 'Unique identifier of the game to check ownership for',
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @ApiOperation({
    summary: 'Check game ownership',
    description: `Check if the authenticated user owns a specific game.
    
**Use Cases:**
- Download Service verification before allowing game downloads
- Store frontend to show "Play" vs "Buy" buttons
- Achievement Service to verify game ownership for achievements
- Review Service to verify ownership before allowing reviews

**Response Details:**
- Returns ownership status with purchase details if owned
- Includes purchase date, price, and currency information
- Used by other services for access control`,
  })
  @ApiResponse({
    status: 200,
    description: 'Ownership status retrieved successfully',
    type: OwnershipResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found in user library',
    type: NotFoundErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
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
    description: `Internal endpoint to add a game to user library after purchase confirmation.
    
**Internal Use Only:**
- Called by Payment Service after successful payment processing
- Requires internal service authentication
- Automatically creates purchase history record
- Triggers cache invalidation for user library

**Workflow:**
1. Payment Service processes payment
2. Payment Service calls this endpoint with purchase details
3. Game is added to user's library
4. Purchase history is created
5. User library cache is invalidated`,
  })
  @ApiResponse({
    status: 201,
    description: 'Game added to library successfully',
    type: LibraryGameDto,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174004',
      gameId: '123e4567-e89b-12d3-a456-426614174001',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      purchaseDate: '2024-01-15T10:30:00Z',
      purchasePrice: 59.99,
      currency: 'RUB',
      orderId: '123e4567-e89b-12d3-a456-426614174002',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid game or user data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal authentication',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: NotFoundErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Game already exists in library',
    type: ConflictErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
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
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Game not found in user library',
    type: NotFoundErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
  })
  async removeGameFromLibrary(
    @Body() dto: RemoveGameFromLibraryDto,
  ): Promise<void> {
    return this.libraryService.removeGameFromLibrary(dto.userId, dto.gameId);
  }

  // Internal endpoint for other services (e.g., Download Service)
  @Get('user/:userId/games')
  @UseGuards(InternalAuthGuard)
  @ApiParam({
    name: 'userId',
    description: 'Unique identifier of the user whose games to retrieve',
    type: 'string',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
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
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: NotFoundErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
  })
  async getUserGamesInternal(
    @Param('userId') userId: string,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryResponseDto> {
    return this.libraryService.getUserLibrary(userId, query);
  }
}
