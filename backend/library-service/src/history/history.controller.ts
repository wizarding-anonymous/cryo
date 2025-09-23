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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { HistoryService } from './history.service';
import { HistoryQueryDto, SearchHistoryDto } from './dto';
import { AddGameToLibraryDto } from '../library/dto';
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
  @ApiOperation({ summary: 'Get purchase history for the current user' })
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
  @ApiOperation({ summary: 'Search in purchase history' })
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
  @ApiOperation({ summary: 'Get details of a specific purchase' })
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
    description:
      'Should only be called by other services like Payment Service.',
  })
  @UseGuards(InternalAuthGuard)
  createPurchaseRecord(@Body() dto: AddGameToLibraryDto) {
    return this.historyService.createPurchaseRecord(dto);
  }
}
