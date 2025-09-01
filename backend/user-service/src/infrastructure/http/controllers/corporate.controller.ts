import { Controller, Post, Body, Get, Param, Put, Delete, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CorporateService } from '../../../application/services/corporate.service';
import { CorporateSSOService, SSOConfiguration } from '../../../application/services/corporate-sso.service';
import { CreateCorporateProfileDto } from '../dtos/create-corporate-profile.dto';
import { AddEmployeeDto } from '../dtos/add-employee.dto';
import { UpdateCorporateProfileDto } from '../dtos/update-corporate-profile.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Corporate Profiles')
@Controller('corporate')
export class CorporateController {
  constructor(
    private readonly corporateService: CorporateService,
    private readonly corporateSSOService: CorporateSSOService,
  ) {}

  @Post('profiles')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new corporate profile' })
  @ApiResponse({ status: 201, description: 'Corporate profile created successfully' })
  @ApiResponse({ status: 409, description: 'Corporate profile already exists for this admin' })
  async createProfile(@Req() req: Request & { user: any }, @Body() companyData: CreateCorporateProfileDto) {
    return this.corporateService.createCorporateProfile(req.user.userId, companyData);
  }

  @Get('profiles/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user corporate profile' })
  @ApiResponse({ status: 200, description: 'Corporate profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile not found' })
  async getMyProfile(@Req() req: Request & { user: any }) {
    return this.corporateService.getCorporateProfileByAdminId(req.user.userId);
  }

  @Get('profiles/:corporateId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'corporate_admin')
  @ApiOperation({ summary: 'Get corporate profile by ID' })
  @ApiResponse({ status: 200, description: 'Corporate profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile not found' })
  async getProfile(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    return this.corporateService.getCorporateProfile(corporateId);
  }

  @Put('profiles/:corporateId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update corporate profile' })
  @ApiResponse({ status: 200, description: 'Corporate profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile not found' })
  async updateProfile(
    @Param('corporateId', ParseUUIDPipe) corporateId: string,
    @Body() updates: UpdateCorporateProfileDto,
  ) {
    return this.corporateService.updateCorporateProfile(corporateId, updates);
  }

  @Get(':corporateId/employees')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get employees of a corporate profile' })
  @ApiResponse({ status: 200, description: 'Employees list retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile not found' })
  async getEmployees(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    const profile = await this.corporateService.getCorporateProfile(corporateId);
    return profile.organization.employees;
  }

  @Post(':corporateId/employees')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add employee to corporate profile' })
  @ApiResponse({ status: 201, description: 'Employee added successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile or user not found' })
  @ApiResponse({ status: 409, description: 'Employee already exists in this corporate profile' })
  async addEmployee(
    @Req() req: Request & { user: any },
    @Param('corporateId', ParseUUIDPipe) corporateId: string,
    @Body() employeeData: AddEmployeeDto,
  ) {
    await this.corporateService.addEmployee(corporateId, employeeData, req.user.userId);
    return { message: 'Employee added successfully' };
  }

  @Delete(':corporateId/employees/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove employee from corporate profile' })
  @ApiResponse({ status: 200, description: 'Employee removed successfully' })
  @ApiResponse({ status: 404, description: 'Corporate profile or employee not found' })
  async removeEmployee(
    @Param('corporateId', ParseUUIDPipe) corporateId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.corporateService.removeEmployee(corporateId, userId);
    return { message: 'Employee removed successfully' };
  }

  @Get(':corporateId/subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get corporate subscription details' })
  @ApiResponse({ status: 200, description: 'Subscription details retrieved successfully' })
  async getSubscription(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    const profile = await this.corporateService.getCorporateProfile(corporateId);
    return profile.subscription;
  }

  @Get(':corporateId/usage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get corporate usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getUsageStats(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    const profile = await this.corporateService.getCorporateProfile(corporateId);
    return profile.usage;
  }

  // SSO Management Endpoints

  @Post(':corporateId/sso/configure')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'corporate_admin')
  @ApiOperation({ summary: 'Configure SSO provider for corporate profile' })
  @ApiResponse({ status: 201, description: 'SSO provider configured successfully' })
  @ApiResponse({ status: 400, description: 'Invalid SSO configuration' })
  async configureSSOProvider(
    @Param('corporateId', ParseUUIDPipe) corporateId: string,
    @Body() ssoConfig: SSOConfiguration,
  ) {
    await this.corporateSSOService.configureSSOProvider(corporateId, ssoConfig);
    return { message: 'SSO provider configured successfully' };
  }

  @Delete(':corporateId/sso')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'corporate_admin')
  @ApiOperation({ summary: 'Disable SSO provider for corporate profile' })
  @ApiResponse({ status: 200, description: 'SSO provider disabled successfully' })
  async disableSSOProvider(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    await this.corporateSSOService.disableSSOProvider(corporateId);
    return { message: 'SSO provider disabled successfully' };
  }

  @Post(':corporateId/sso/login')
  @ApiOperation({ summary: 'Authenticate user via SSO' })
  @ApiResponse({ status: 200, description: 'SSO authentication successful' })
  @ApiResponse({ status: 401, description: 'SSO authentication failed' })
  async ssoLogin(@Param('corporateId', ParseUUIDPipe) corporateId: string, @Body('ssoToken') ssoToken: string) {
    const result = await this.corporateSSOService.authenticateWithSSO(corporateId, ssoToken);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post(':corporateId/sso/sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'corporate_admin')
  @ApiOperation({ summary: 'Sync users from SSO provider' })
  @ApiResponse({ status: 200, description: 'User sync completed' })
  async syncUsersFromSSO(@Param('corporateId', ParseUUIDPipe) corporateId: string) {
    const result = await this.corporateSSOService.syncUsersFromSSO(corporateId);
    return {
      message: 'User sync completed',
      syncedUsers: result.synced,
      errors: result.errors,
    };
  }
}
