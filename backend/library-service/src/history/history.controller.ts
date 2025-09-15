import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { HistoryQueryDto, SearchHistoryDto } from './dto/request.dto';
import { AddGameToLibraryDto } from '../library/dto/request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

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
  @ApiOperation({ summary: 'Get purchase history for the current user' })
  getPurchaseHistory(@Req() request: AuthenticatedRequest, @Query() query: HistoryQueryDto) {
    const userId = request.user.id;
    return this.historyService.getPurchaseHistory(userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search in purchase history' })
  searchHistory(@Req() request: AuthenticatedRequest, @Query() query: SearchHistoryDto) {
    const userId = request.user.id;
    return this.historyService.searchPurchaseHistory(userId, query);
  }

  @Get(':purchaseId')
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
    description: 'Should only be called by other services like Payment Service.',
  })
  @UseGuards(InternalAuthGuard)
  createPurchaseRecord(@Body() dto: AddGameToLibraryDto) {
    return this.historyService.createPurchaseRecord(dto);
  }
}
