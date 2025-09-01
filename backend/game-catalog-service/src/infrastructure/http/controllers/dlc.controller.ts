import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { DlcService } from '../../../application/services/dlc.service';
import { Dlc } from '../../../domain/entities/dlc.entity';

class CreateDlcDto {
    title: string;
    description?: string;
    price: number;
    releaseDate?: Date;
}

@Controller('games/:gameId/dlc')
export class DlcController {
  constructor(private readonly dlcService: DlcService) {}

  @Post()
  createDlc(@Param('gameId') gameId: string, @Body() createDlcDto: CreateDlcDto) {
    return this.dlcService.createDlc(gameId, createDlcDto);
  }

  @Get()
  findDlcsForGame(@Param('gameId') gameId: string): Promise<Dlc[]> {
    return this.dlcService.findDlcsForGame(gameId);
  }
}
