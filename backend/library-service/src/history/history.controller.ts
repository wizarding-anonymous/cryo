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
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // To be created in a later step

@ApiTags('Purchase History')
@ApiBearerAuth() // Indicates that the endpoints require a bearer token
// @UseGuards(JwtAuthGuard) // To be enabled later
@Controller('library/history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get purchase history for the current user' })
  getPurchaseHistory(@Req() request, @Query() query: HistoryQueryDto) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder
    return this.historyService.getPurchaseHistory(userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search in purchase history' })
  searchHistory(@Req() request, @Query() query: SearchHistoryDto) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder
    return this.historyService.searchPurchaseHistory(userId, query);
  }

  @Get(':purchaseId')
  @ApiOperation({ summary: 'Get details of a specific purchase' })
  getPurchaseDetails(
    @Req() request,
    @Param('purchaseId') purchaseId: string,
  ) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder
    return this.historyService.getPurchaseDetails(userId, purchaseId);
  }

  // --- Internal Endpoint --- //

  @Post()
  @ApiOperation({
    summary: 'Create a purchase record (Internal)',
    description: 'Should only be called by other services like Payment Service.',
  })
  createPurchaseRecord(@Body() dto: AddGameToLibraryDto) {
    return this.historyService.createPurchaseRecord(dto);
  }
}
