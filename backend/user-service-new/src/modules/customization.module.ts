import { Module } from '@nestjs/common';
import { CustomizationService } from '../application/services/customization.service';

@Module({
  providers: [CustomizationService],
  exports: [CustomizationService],
})
export class CustomizationModule {}
