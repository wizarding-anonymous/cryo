import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DlcService } from '../../../application/services/dlc.service';
import { Dlc } from '../../../domain/entities/dlc.entity';
import { CreateDlcDto } from '../dtos/create-dlc.dto';
import { UpdateDlcDto } from '../dtos/update-dlc.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('DLCs')
@Controller('dlc')
export class DlcController {
  constructor(private readonly dlcService: DlcService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new DLC' })
  @ApiResponse({ status: 201, description: 'The DLC has been successfully created.', type: Dlc })
  create(@Body() createDlcDto: CreateDlcDto): Promise<Dlc> {
    return this.dlcService.create(createDlcDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all DLCs for a specific game' })
  @ApiQuery({ name: 'gameId', required: true, description: 'ID of the base game', type: String })
  @ApiResponse({ status: 200, description: 'A list of DLCs for the game.' })
  findByGame(@Query('gameId') gameId: string) {
    return this.dlcService.findByGame(gameId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single DLC by ID' })
  @ApiResponse({ status: 200, description: 'The DLC object.', type: Dlc })
  @ApiResponse({ status: 404, description: 'DLC not found.' })
  findOne(@Param('id') id: string): Promise<Dlc> {
    return this.dlcService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a DLC' })
  @ApiResponse({ status: 200, description: 'The DLC has been successfully updated.', type: Dlc })
  @ApiResponse({ status: 404, description: 'DLC not found.' })
  update(@Param('id') id: string, @Body() updateDlcDto: UpdateDlcDto): Promise<Dlc> {
    return this.dlcService.update(id, updateDlcDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a DLC' })
  @ApiResponse({ status: 204, description: 'The DLC has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'DLC not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.dlcService.remove(id);
  }
}
