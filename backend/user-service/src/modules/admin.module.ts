import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../domain/entities/user.entity';
import { AdminService } from '../application/services/admin.service';
import { AdminController } from '../infrastructure/http/controllers/admin.controller';
import { RoleModule } from './role.module'; // RoleService is needed for RolesGuard
import { IntegrationModule } from './integration.module';
import { EventsModule } from '../application/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    RoleModule, 
    IntegrationModule,
    EventsModule
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
