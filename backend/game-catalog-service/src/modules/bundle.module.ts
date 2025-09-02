import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bundle } from '../domain/entities/bundle.entity';
import { Game } from '../domain/entities/game.entity';
import { BundleService } from '../application/services/bundle.service';
import { BundleController } from '../infrastructure/http/controllers/bundle.controller';
import { BundleRepository } from '../infrastructure/persistence/bundle.repository';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Bundle, Game])],
  providers: [BundleService, BundleRepository, GameRepository],
  controllers: [BundleController],
  exports: [BundleService],
})
export class BundleModule {}
