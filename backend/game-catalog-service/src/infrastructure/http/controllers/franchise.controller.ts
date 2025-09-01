import { Controller, Post, Body, Param, Get, Patch } from '@nestjs/common';
import { FranchiseService } from '../../../application/services/franchise.service';

class CreateFranchiseDto {
    name: string;
    description?: string;
    gameIds: string[];
}

class AddGameToFranchiseDto {
    gameId: string;
}

@Controller('franchises')
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Post()
  createFranchise(@Body() createFranchiseDto: CreateFranchiseDto) {
    const { gameIds, ...franchiseData } = createFranchiseDto;
    return this.franchiseService.createFranchise(franchiseData, gameIds);
  }

  @Get(':id')
  findFranchiseById(@Param('id') id: string) {
    return this.franchiseService.findFranchiseById(id);
  }

  @Patch(':id/games')
  addGameToFranchise(@Param('id') id: string, @Body() addGameDto: AddGameToFranchiseDto) {
    return this.franchiseService.addGameToFranchise(id, addGameDto.gameId);
  }
}
