import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Demo } from '../domain/entities/demo.entity';
import { Game } from '../domain/entities/game.entity';
import { DemoService } from '../application/services/demo.service';
import { DemoController } from '../infrastructure/http/controllers/demo.controller';
import { GameRepository } from '../infrastructure/persistence/game.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Demo, Game])],
  providers: [DemoService, GameRepository],
  controllers: [DemoController],
  exports: [DemoService],
})
export class DemoModule {}
