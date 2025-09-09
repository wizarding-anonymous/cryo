import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaService } from '../application/services/media.service';
import { MediaController } from '../infrastructure/http/controllers/media.controller';
import { Game } from '../domain/entities/game.entity';
import { Screenshot } from '../domain/entities/screenshot.entity';
import { Video } from '../domain/entities/video.entity';
import { GameRepository } from '../infrastructure/persistence/game.repository';
import { ScreenshotRepository } from '../infrastructure/persistence/screenshot.repository';
import { VideoRepository } from '../infrastructure/persistence/video.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Screenshot, Video])],
  providers: [MediaService, GameRepository, ScreenshotRepository, VideoRepository],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
