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
import { CacheInterceptor } from '../common/interceptors/cache.interceptor';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import { LibraryQueryDto, SearchLibraryDto, AddGameToLibraryDto } from './dto/request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { RoleGuard, Roles } from '../auth/guards/role.guard';

// Define a type for authenticated requests
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    roles: string[];
  };
}

@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly searchService: SearchService,
  ) {}

  @Get('my')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  getMyLibrary(@Req() request: AuthenticatedRequest, @Query() query: LibraryQueryDto) {
    const userId = request.user.id;
    return this.libraryService.getUserLibrary(userId, query);
  }

  @Get('my/search')
  searchMyLibrary(@Req() request: AuthenticatedRequest, @Query() query: SearchLibraryDto) {
    const userId = request.user.id;
    return this.searchService.searchUserLibrary(userId, query);
  }

  @Get('ownership/:gameId')
  @UseGuards(OwnershipGuard)
  checkOwnership(@Req() request: AuthenticatedRequest, @Param('gameId') gameId: string) {
    const userId = request.user.id;
    return this.libraryService.checkGameOwnership(userId, gameId);
  }

  // --- Internal Endpoints --- //
  // These should be protected by an internal-only guard or network policies in a real scenario
  // For now, let's assume an admin role is needed.

  @Post('add')
  @UseGuards(RoleGuard)
  @Roles('admin', 'internal-service')
  addGameToLibrary(@Body() dto: AddGameToLibraryDto) {
    return this.libraryService.addGameToLibrary(dto);
  }

  @Delete('remove')
  @UseGuards(RoleGuard)
  @Roles('admin', 'internal-service')
  removeGameFromLibrary(@Body() body: { userId: string; gameId: string }) {
    return this.libraryService.removeGameFromLibrary(body.userId, body.gameId);
  }
}
