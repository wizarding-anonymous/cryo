import { Module, Global } from '@nestjs/common';
import { AlsService } from './als.service';

@Global()
@Module({
  providers: [AlsService],
  exports: [AlsService],
})
export class AlsModule {}
