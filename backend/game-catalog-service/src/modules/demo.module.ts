import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoService } from '../application/services/demo.service';
import { DemoController } from '../infrastructure/http/controllers/demo.controller';
import { Demo } from '../domain/entities/demo.entity';
import { Game } from '../domain/entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Demo, Game])],
  providers: [DemoService],
  controllers: [DemoController],
})
export class DemoModule {}
