import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  controllers: [HealthController],
})
export class HealthModule {}
