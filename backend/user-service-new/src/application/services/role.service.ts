import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../domain/entities/role.entity';
import { UserRole } from '../../domain/entities/user-role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  // Role Management
  async createRole(name: string, description: string, permissions: string[]): Promise<Role> {
    const newRole = this.roleRepository.create({ name, description, permissions });
    return this.roleRepository.save(newRole);
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    await this.roleRepository.update(roleId, updates);
    const updatedRole = await this.roleRepository.findOneBy({ id: roleId });
    if (!updatedRole) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }
    return updatedRole;
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.roleRepository.delete(roleId);
  }

  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  // User Role Assignment
  async assignRole(userId: string, roleId: string): Promise<UserRole> {
    const assignment = this.userRoleRepository.create({ userId, roleId });
    return this.userRoleRepository.save(assignment);
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepository.delete({ userId, roleId });
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const assignments = await this.userRoleRepository.find({ where: { userId }, relations: ['role'] });
    return assignments.map(a => (a as any).role); // TypeORM relations are tricky
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<string>();
    roles.forEach(role => {
      role.permissions.forEach(p => permissions.add(p));
    });
    return Array.from(permissions);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  }

  async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    return userRoles.some(role => roleNames.includes(role.name));
  }
}
