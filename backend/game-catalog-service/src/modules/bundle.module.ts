import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BundleService } from '../application/services/bundle.service';
import { BundleController } from '../infrastructure/http/controllers/bundle.controller';
import { Bundle } from '../domain/entities/bundle.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bundle, Game])],
  providers: [BundleService],
  controllers: [BundleController],
})
export class BundleModule {}
