import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../domain/entities/role.entity';

const DEFAULT_ROLES = [
  {
    name: 'user',
    description: 'Обычный пользователь',
    permissions: ['profile:read', 'profile:update', 'games:purchase']
  },
  {
    name: 'developer',
    description: 'Разработчик игр',
    permissions: ['profile:read', 'profile:update', 'games:publish', 'analytics:read']
  },
  {
    name: 'moderator',
    description: 'Модератор контента',
    permissions: ['users:read', 'content:moderate', 'reports:handle']
  },
  {
    name: 'admin',
    description: 'Администратор системы',
    permissions: ['*']
  }
];

@Injectable()
export class RoleSeederService {
  private readonly logger = new Logger(RoleSeederService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async seed() {
    this.logger.log('Seeding default roles...');
    for (const roleData of DEFAULT_ROLES) {
        const existingRole = await this.roleRepository.findOneBy({ name: roleData.name });
        if (!existingRole) {
            const newRole = this.roleRepository.create(roleData);
            await this.roleRepository.save(newRole);
            this.logger.log(`Created role: ${roleData.name}`);
        }
    }
    this.logger.log('Role seeding complete.');
  }
}
