import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { MfaService } from '../application/services/mfa.service';
import { MfaController } from '../infrastructure/http/controllers/mfa.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [MfaService],
  controllers: [MfaController],
})
export class MfaModule {}
