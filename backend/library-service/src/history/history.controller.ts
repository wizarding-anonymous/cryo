import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth, 
  ApiResponse,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { HistoryService } from './history.service';
import { HistoryQueryDto, SearchHistoryDto, HistoryResponseDto, PurchaseDetailsDto } from './dto';
import { AddGameToLibraryDto } from '../library/dto';
import {
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
  NotFoundErrorResponseDto,
  ConflictErrorResponseDto,
  InternalServerErrorResponseDto,
} from '../common/dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';

// Define a type for authenticated requests
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    roles: string[];
  };
}

@ApiTags('Purchase History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('library/history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(600) // 10 minutes for history
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: 'number',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: 'number',
    example: 20
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['createdAt', 'amount', 'status'],
    example: 'createdAt'
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc'
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by purchase status',
    required: false,
    enum: ['completed', 'refunded', 'cancelled'],
    example: 'completed'
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter purchases from this date (ISO 8601 format)',
    required: false,
    type: 'string',
    example: '2024-01-01T00:00:00Z'
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter purchases to this date (ISO 8601 format)',
    required: false,
    type: 'string',
    example: '2024-12-31T23:59:59Z'
  })
  @ApiOperation({ 
    summary: 'Get purchase history for the current user',
    description: `Retrieve the authenticated user's purchase history with comprehensive filtering and pagination.
    
**Features:**
- Paginated results with configurable page size
- Filter by purchase status (completed, refunded, cancelled)
- Filter by date range (fromDate, toDate)
- Sort by creation date, amount, or status
- Enriched with game details from catalog service

**Example Usage:**
- All purchases: \`GET /api/library/history\`
- Recent purchases: \`GET /api/library/history?fromDate=2024-01-01T00:00:00Z\`
- Completed only: \`GET /api/library/history?status=completed\`
- Sort by amount: \`GET /api/library/history?sortBy=amount&sortOrder=desc\``
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase history retrieved successfully',
    type: HistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
  })
  getPurchaseHistory(
    @Req() request: AuthenticatedRequest,
    @Query() query: HistoryQueryDto,
  ) {
    const userId = request.user.id;
    return this.historyService.getPurchaseHistory(userId, query);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120) // 2 minutes for search results
  @ApiQuery({
    name: 'query',
    description: 'Search query string for game titles (minimum 2 characters)',
    required: true,
    type: 'string',
    example: 'cyberpunk'
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    required: false,
    type: 'number',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    required: false,
    type: 'number',
    example: 20
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Field to sort by',
    required: false,
    enum: ['createdAt', 'amount', 'status'],
    example: 'createdAt'
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc'
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by purchase status',
    required: false,
    enum: ['completed', 'refunded', 'cancelled'],
    example: 'completed'
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter purchases from this date (ISO 8601 format)',
    required: false,
    type: 'string',
    example: '2024-01-01T00:00:00Z'
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter purchases to this date (ISO 8601 format)',
    required: false,
    type: 'string',
    example: '2024-12-31T23:59:59Z'
  })
  @ApiOperation({ 
    summary: 'Search in purchase history',
    description: `Search through the authenticated user's purchase history by game title with advanced filtering.
    
**Search Features:**
- Full-text search across game titles in purchase history
- Combine search with status filtering
- Combine search with date range filtering
- Fuzzy matching for typos and partial matches
- Case-insensitive search

**Example Searches:**
- By game title: \`GET /api/library/history/search?query=cyberpunk\`
- Recent purchases of specific game: \`GET /api/library/history/search?query=witcher&fromDate=2024-01-01T00:00:00Z\`
- Completed purchases only: \`GET /api/library/history/search?query=game&status=completed\``
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: HistoryResponseDto,
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
  searchHistory(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchHistoryDto,
  ) {
    const userId = request.user.id;
    return this.historyService.searchPurchaseHistory(userId, query);
  }

  @Get(':purchaseId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800) // 30 minutes for purchase details
  @ApiOperation({ 
    summary: 'Get details of a specific purchase',
    description: 'Retrieve detailed information about a specific purchase by its ID'
  })
  @ApiParam({
    name: 'purchaseId',
    description: 'Unique identifier of the purchase',
    type: 'string',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase details retrieved successfully',
    type: PurchaseDetailsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Purchase not found or does not belong to the user',
    type: NotFoundErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
  })
  getPurchaseDetails(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
  ) {
    const userId = request.user.id;
    return this.historyService.getPurchaseDetails(userId, purchaseId);
  }

  // --- Internal Endpoint --- //

  @Post()
  @ApiOperation({
    summary: 'Create a purchase record (Internal)',
    description: 'Internal endpoint to create a purchase record. Should only be called by other services like Payment Service.',
  })
  @ApiResponse({
    status: 201,
    description: 'Purchase record created successfully',
    type: PurchaseDetailsDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid purchase data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal authentication',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Purchase record already exists',
    type: ConflictErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: InternalServerErrorResponseDto,
  })
  @UseGuards(InternalAuthGuard)
  createPurchaseRecord(@Body() dto: AddGameToLibraryDto) {
    return this.historyService.createPurchaseRecord(dto);
  }
}
