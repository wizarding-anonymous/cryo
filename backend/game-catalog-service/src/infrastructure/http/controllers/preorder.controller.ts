import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PreorderService } from '../../../application/services/preorder.service';
import { Preorder } from '../../../domain/entities/preorder.entity';
import { CreatePreorderDto } from '../dtos/create-preorder.dto';
import { UpdatePreorderDto } from '../dtos/update-preorder.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Preorders')
@Controller('preorders')
export class PreorderController {
  constructor(private readonly preorderService: PreorderService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new preorder campaign' })
  @ApiResponse({ status: 201, description: 'The preorder has been successfully created.', type: Preorder })
  create(@Body() createPreorderDto: CreatePreorderDto): Promise<Preorder> {
    return this.preorderService.create(createPreorderDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single preorder by ID' })
  @ApiResponse({ status: 200, description: 'The preorder object.', type: Preorder })
  @ApiResponse({ status: 404, description: 'Preorder not found.' })
  findOne(@Param('id') id: string): Promise<Preorder> {
    return this.preorderService.findOne(id);
  }

  @Get('game/:gameId')
  @ApiOperation({ summary: 'Get a preorder for a specific game' })
  @ApiResponse({ status: 200, description: 'The preorder object for the game.', type: Preorder })
  findByGame(@Param('gameId') gameId: string): Promise<Preorder | null> {
    return this.preorderService.findByGame(gameId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a preorder' })
  @ApiResponse({ status: 200, description: 'The preorder has been successfully updated.', type: Preorder })
  @ApiResponse({ status: 404, description: 'Preorder not found.' })
  update(@Param('id') id: string, @Body() updatePreorderDto: UpdatePreorderDto): Promise<Preorder> {
    return this.preorderService.update(id, updatePreorderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a preorder' })
  @ApiResponse({ status: 204, description: 'The preorder has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Preorder not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.preorderService.remove(id);
  }
}
