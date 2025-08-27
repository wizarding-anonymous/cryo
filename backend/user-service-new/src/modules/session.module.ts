import { Module } from '@nestjs/common';
import { SessionService } from '../application/services/session.service';

@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
