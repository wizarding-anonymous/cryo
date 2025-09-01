import { Controller, Get, Post, Body, Param, Put, Delete, Query, ValidationPipe, UsePipes } from '@nestjs/common';
import { GameService } from '../../../application/services/game.service';
import { Game } from '../../../domain/entities/game.entity';
import { CreateGameDto } from '../dtos/create-game.dto';
import { UpdateGameDto } from '../dtos/update-game.dto';
import { PaginationDto } from '../dtos/pagination.dto';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  findAll(@Query() paginationDto: PaginationDto) {
    return this.gameService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Game | null> {
    return this.gameService.findOne(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() createGameDto: CreateGameDto): Promise<Game> {
    return this.gameService.create(createGameDto);
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto): Promise<Game> {
    return this.gameService.update(id, updateGameDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.gameService.remove(id);
  }
}
