import { Module } from '@nestjs/common';
import { MediaService } from '../application/services/media.service';
import { MediaController } from '../infrastructure/http/controllers/media.controller';

@Module({
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
