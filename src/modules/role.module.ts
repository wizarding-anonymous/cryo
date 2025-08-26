import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../domain/entities/role.entity';
import { UserRole } from '../domain/entities/user-role.entity';
import { RoleService } from '../application/services/role.service';
import { RoleController } from '../infrastructure/http/controllers/role.controller';
import { RoleSeederService } from '../application/services/role-seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, UserRole])],
  providers: [RoleService, RoleSeederService],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule implements OnModuleInit {
    constructor(private readonly seederService: RoleSeederService) {}

    async onModuleInit() {
        await this.seederService.seed();
    }
}
