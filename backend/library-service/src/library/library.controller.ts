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
} from '@nestjs/common';
import { LibraryService } from './library.service';
import { SearchService } from './search.service';
import { LibraryQueryDto, SearchLibraryDto, AddGameToLibraryDto } from './dto/request.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // To be created in a later step
// import { OwnershipGuard } from '../auth/guards/ownership.guard'; // To be created in a later step

// @UseGuards(JwtAuthGuard) // To be enabled later
@Controller('library')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly searchService: SearchService,
  ) {}

  @Get('my')
  // @UseGuards(OwnershipGuard) // To be enabled later
  getMyLibrary(@Req() request, @Query() query: LibraryQueryDto) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder until auth is integrated
    return this.libraryService.getUserLibrary(userId, query);
  }

  @Get('my/search')
  searchMyLibrary(@Req() request, @Query() query: SearchLibraryDto) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder
    return this.searchService.searchUserLibrary(userId, query);
  }

  @Get('ownership/:gameId')
  checkOwnership(@Req() request, @Param('gameId') gameId: string) {
    // const userId = request.user.id;
    const userId = 'placeholder-user-id'; // Placeholder
    return this.libraryService.checkGameOwnership(userId, gameId);
  }

  // --- Internal Endpoints --- //

  @Post('add')
  // This should be protected by an internal-only guard or network policies in a real scenario
  addGameToLibrary(@Body() dto: AddGameToLibraryDto) {
    return this.libraryService.addGameToLibrary(dto);
  }

  @Delete('remove')
  // This should be protected as well
  removeGameFromLibrary(@Body() body: { userId: string; gameId: string }) {
    return this.libraryService.removeGameFromLibrary(body.userId, body.gameId);
  }
}
