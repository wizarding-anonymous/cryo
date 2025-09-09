import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FranchiseService } from '../../../application/services/franchise.service';
import { Franchise } from '../../../domain/entities/franchise.entity';
import { CreateFranchiseDto } from '../dtos/create-franchise.dto';
import { UpdateFranchiseDto } from '../dtos/update-franchise.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Franchises')
@Controller('franchises')
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new franchise' })
  @ApiResponse({ status: 201, description: 'The franchise has been successfully created.', type: Franchise })
  create(@Body() createFranchiseDto: CreateFranchiseDto): Promise<Franchise> {
    return this.franchiseService.create(createFranchiseDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single franchise by ID' })
  @ApiResponse({ status: 200, description: 'The franchise object.', type: Franchise })
  @ApiResponse({ status: 404, description: 'Franchise not found.' })
  findOne(@Param('id') id: string): Promise<Franchise> {
    return this.franchiseService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a franchise' })
  @ApiResponse({ status: 200, description: 'The franchise has been successfully updated.', type: Franchise })
  @ApiResponse({ status: 404, description: 'Franchise not found.' })
  update(@Param('id') id: string, @Body() updateFranchiseDto: UpdateFranchiseDto): Promise<Franchise> {
    return this.franchiseService.update(id, updateFranchiseDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a franchise' })
  @ApiResponse({ status: 204, description: 'The franchise has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Franchise not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.franchiseService.remove(id);
  }
}
