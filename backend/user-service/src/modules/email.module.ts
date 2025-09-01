import { Module } from '@nestjs/common';
import { MockEmailService } from '../application/services/mock-email.service';
import { IEmailService } from '../domain/interfaces/email.interface';

@Module({
  providers: [
    {
      provide: IEmailService,
      useClass: MockEmailService,
    },
  ],
  exports: [IEmailService],
})
export class EmailModule {}