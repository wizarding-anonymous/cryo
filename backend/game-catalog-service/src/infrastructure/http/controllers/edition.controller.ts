import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EditionService } from '../../../application/services/edition.service';
import { GameEdition } from '../../../domain/entities/game-edition.entity';
import { CreateEditionDto } from '../dtos/create-edition.dto';
import { UpdateEditionDto } from '../dtos/update-edition.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Game Editions')
@Controller('editions')
export class EditionController {
  constructor(private readonly editionService: EditionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new game edition' })
  @ApiResponse({ status: 201, description: 'The edition has been successfully created.', type: GameEdition })
  create(@Body() createEditionDto: CreateEditionDto): Promise<GameEdition> {
    return this.editionService.create(createEditionDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single edition by ID' })
  @ApiResponse({ status: 200, description: 'The edition object.', type: GameEdition })
  @ApiResponse({ status: 404, description: 'Edition not found.' })
  findOne(@Param('id') id: string): Promise<GameEdition> {
    return this.editionService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an edition' })
  @ApiResponse({ status: 200, description: 'The edition has been successfully updated.', type: GameEdition })
  @ApiResponse({ status: 404, description: 'Edition not found.' })
  update(@Param('id') id: string, @Body() updateEditionDto: UpdateEditionDto): Promise<GameEdition> {
    return this.editionService.update(id, updateEditionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an edition' })
  @ApiResponse({ status: 204, description: 'The edition has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Edition not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.editionService.remove(id);
  }
}
