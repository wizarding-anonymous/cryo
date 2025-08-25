import { Module } from '@nestjs/common';
import { AppController } from './infrastructure/http/app.controller';
import { AppService } from './application/use-cases/app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
