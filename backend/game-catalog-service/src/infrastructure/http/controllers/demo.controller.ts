import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { DemoService } from '../../../application/services/demo.service';
import { DemoType } from '../../../domain/entities/demo.entity';

class CreateDemoDto {
    type: DemoType;
    timeLimitMinutes?: number;
    contentDescription?: string;
    downloadUrl?: string;
    isAvailable: boolean;
}

@Controller('games/:gameId/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post()
  createDemo(@Param('gameId') gameId: string, @Body() createDemoDto: CreateDemoDto) {
    return this.demoService.createDemo(gameId, createDemoDto);
  }

  @Get()
  getDemo(@Param('gameId') gameId: string) {
    return this.demoService.getDemoForGame(gameId);
  }
}
