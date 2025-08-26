import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleService } from '../../../application/services/role.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Admin: Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/roles')
export class RoleController {
    constructor(private readonly roleService: RoleService) {}

    @Get()
    @Roles('admin')
    @ApiOperation({ summary: 'Get all roles' })
    getAllRoles() {
        return this.roleService.getAllRoles();
    }

    @Post()
    @Roles('admin')
    @ApiOperation({ summary: 'Create a new role' })
    createRole(@Body() body: { name: string, description: string, permissions: string[] }) {
        return this.roleService.createRole(body.name, body.description, body.permissions);
    }
}
