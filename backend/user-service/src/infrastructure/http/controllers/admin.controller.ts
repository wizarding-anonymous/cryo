import { Controller, Get, Query, Put, Param, ParseUUIDPipe, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService, UserSearchCriteria } from '../../../application/services/admin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuditActions, AuditResources, Audit } from '../../auth/decorators/audit.decorator';

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
  @Audit(AuditActions.BLOCK, AuditResources.USER)
  blockUser(@Param('id', ParseUUIDPipe) userIdToBlock: string, @Body('reason') reason: string, @Req() req) {
    const adminId = req.user.userId;
    return this.adminService.blockUser(userIdToBlock, adminId, reason);
  }
}
