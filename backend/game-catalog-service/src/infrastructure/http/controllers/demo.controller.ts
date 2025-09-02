import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DemoService } from '../../../application/services/demo.service';
import { Demo } from '../../../domain/entities/demo.entity';
import { CreateDemoDto } from '../dtos/create-demo.dto';
import { UpdateDemoDto } from '../dtos/update-demo.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Game Demos')
@Controller('demos')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new game demo' })
  @ApiResponse({ status: 201, description: 'The demo has been successfully created.', type: Demo })
  create(@Body() createDemoDto: CreateDemoDto): Promise<Demo> {
    return this.demoService.create(createDemoDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single demo by ID' })
  @ApiResponse({ status: 200, description: 'The demo object.', type: Demo })
  @ApiResponse({ status: 404, description: 'Demo not found.' })
  findOne(@Param('id') id: string): Promise<Demo> {
    return this.demoService.findOne(id);
  }

  @Get('game/:gameId')
  @ApiOperation({ summary: 'Get a demo for a specific game' })
  @ApiResponse({ status: 200, description: 'The demo object for the game.', type: Demo })
  @ApiResponse({ status: 404, description: 'Demo not found for this game.' })
  findByGame(@Param('gameId') gameId: string): Promise<Demo | null> {
    return this.demoService.findByGame(gameId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a demo' })
  @ApiResponse({ status: 200, description: 'The demo has been successfully updated.', type: Demo })
  @ApiResponse({ status: 404, description: 'Demo not found.' })
  update(@Param('id') id: string, @Body() updateDemoDto: UpdateDemoDto): Promise<Demo> {
    return this.demoService.update(id, updateDemoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a demo' })
  @ApiResponse({ status: 204, description: 'The demo has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Demo not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.demoService.remove(id);
  }
}
