import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { EditionService } from '../../../application/services/edition.service';

class CreateEditionDto {
    name: string;
    price: number;
    content: any;
}

@Controller('games/:gameId/editions')
export class EditionController {
  constructor(private readonly editionService: EditionService) {}

  @Post()
  createEdition(@Param('gameId') gameId: string, @Body() createEditionDto: CreateEditionDto) {
    return this.editionService.createEdition(gameId, createEditionDto);
  }

  @Get()
  findEditionsForGame(@Param('gameId') gameId: string) {
    return this.editionService.findEditionsForGame(gameId);
  }
}
