import { Controller, Get, Query, Put, Param, ParseUUIDPipe, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService, UserSearchCriteria } from '../../../application/services/admin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuditAction, AuditResource } from '../auth/decorators/audit.decorator';

@ApiTags('Admin: User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('search')
    @Roles('admin', 'moderator')
    @ApiOperation({ summary: 'Search and filter users' })
    searchUsers(@Query() criteria: UserSearchCriteria) {
        return this.adminService.searchUsers(criteria);
    }

    @Put(':id/block')
    @Roles('admin', 'moderator')
    @ApiOperation({ summary: 'Block a user' })
    @AuditAction('user.block')
    @AuditResource('user')
    blockUser(
        @Param('id', ParseUUIDPipe) userId: string,
        @Body('reason') reason: string,
    ) {
        return this.adminService.blockUser(userId, reason);
    }
}
