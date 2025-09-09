import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PromotionService } from '../../../application/services/promotion.service';
import { Discount } from '../../../domain/entities/discount.entity';
import { CreatePromotionDto } from '../dtos/create-promotion.dto';
import { UpdatePromotionDto } from '../dtos/update-promotion.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promotion (discount)' })
  @ApiResponse({ status: 201, description: 'The promotion has been successfully created.', type: Discount })
  create(@Body() createPromotionDto: CreatePromotionDto): Promise<Discount> {
    return this.promotionService.create(createPromotionDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single promotion by ID' })
  @ApiResponse({ status: 200, description: 'The promotion object.', type: Discount })
  @ApiResponse({ status: 404, description: 'Promotion not found.' })
  findOne(@Param('id') id: string): Promise<Discount> {
    return this.promotionService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion' })
  @ApiResponse({ status: 200, description: 'The promotion has been successfully updated.', type: Discount })
  @ApiResponse({ status: 404, description: 'Promotion not found.' })
  update(@Param('id') id: string, @Body() updatePromotionDto: UpdatePromotionDto): Promise<Discount> {
    return this.promotionService.update(id, updatePromotionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion' })
  @ApiResponse({ status: 204, description: 'The promotion has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Promotion not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.promotionService.remove(id);
  }
}
