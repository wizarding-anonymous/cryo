import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BundleService } from '../../../application/services/bundle.service';
import { Bundle } from '../../../domain/entities/bundle.entity';
import { CreateBundleDto } from '../dtos/create-bundle.dto';
import { UpdateBundleDto } from '../dtos/update-bundle.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Bundles')
@Controller('bundles')
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new bundle' })
  @ApiResponse({ status: 201, description: 'The bundle has been successfully created.', type: Bundle })
  create(@Body() createBundleDto: CreateBundleDto): Promise<Bundle> {
    return this.bundleService.create(createBundleDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bundle by ID' })
  @ApiResponse({ status: 200, description: 'The bundle object.', type: Bundle })
  @ApiResponse({ status: 404, description: 'Bundle not found.' })
  findOne(@Param('id') id: string): Promise<Bundle> {
    return this.bundleService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a bundle' })
  @ApiResponse({ status: 200, description: 'The bundle has been successfully updated.', type: Bundle })
  @ApiResponse({ status: 404, description: 'Bundle not found.' })
  update(@Param('id') id: string, @Body() updateBundleDto: UpdateBundleDto): Promise<Bundle> {
    return this.bundleService.update(id, updateBundleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a bundle' })
  @ApiResponse({ status: 204, description: 'The bundle has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Bundle not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.bundleService.remove(id);
  }
}
