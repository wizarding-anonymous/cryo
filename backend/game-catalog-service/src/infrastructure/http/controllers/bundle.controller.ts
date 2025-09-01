import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { BundleService } from '../../../application/services/bundle.service';

class CreateBundleDto {
    name: string;
    description?: string;
    price: number;
    gameIds: string[];
}

@Controller('bundles')
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  @Post()
  createBundle(@Body() createBundleDto: CreateBundleDto) {
    const { gameIds, ...bundleData } = createBundleDto;
    return this.bundleService.createBundle(bundleData, gameIds);
  }

  @Get(':id')
  findBundleById(@Param('id') id: string) {
    return this.bundleService.findBundleById(id);
  }
}
