import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Put, 
  Delete, 
  Param, 
  Query,
  UseGuards,
  Request,
  BadRequestException 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CorporateService, SSOConfiguration } from '../../../application/services/corporate.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { 
  CreateCorporateProfileDto, 
  AddEmployeeDto, 
  CreateDepartmentDto, 
  ConfigureSSODto,
  UpdateEmployeeRoleDto 
} from '../dtos/corporate.dto';

@ApiTags('Corporate Profiles')
@Controller('corporate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CorporateController {
    constructor(private readonly corporateService: CorporateService) {}

    @Post('profile')
    @ApiOperation({ summary: 'Create a new corporate profile' })
    @ApiResponse({ status: 201, description: 'Corporate profile created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid company data or INN already exists' })
    async createProfile(@Request() req: any, @Body() companyData: CreateCorporateProfileDto) {
        return this.corporateService.createCorporateProfile(req.user.userId, companyData);
    }

    @Get('profile')
    @ApiOperation({ summary: 'Get current user corporate profile' })
    @ApiResponse({ status: 200, description: 'Corporate profile retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Corporate profile not found' })
    async getProfile(@Request() req: any) {
        // В реальной реализации нужно найти корпоративный профиль по adminUserId
        // Для примера используем заглушку
        throw new BadRequestException('Implementation needed: find corporate profile by admin user ID');
    }

    @Put('profile')
    @ApiOperation({ summary: 'Update corporate profile' })
    @ApiResponse({ status: 200, description: 'Corporate profile updated successfully' })
    async updateProfile(@Request() req: any, @Body() updates: Partial<CreateCorporateProfileDto>) {
        // Нужно найти corporateId по adminUserId
        throw new BadRequestException('Implementation needed: find corporate profile by admin user ID');
    }

    @Get(':corporateId/employees')
    @ApiOperation({ summary: 'Get employees of a corporate profile' })
    @ApiResponse({ status: 200, description: 'Employees list retrieved successfully' })
    @Roles('corporate_admin', 'corporate_manager')
    @UseGuards(RolesGuard)
    async getEmployees(@Param('corporateId') corporateId: string) {
        const profile = await this.corporateService.getCorporateProfile(corporateId);
        return profile.organization.employees || [];
    }

    @Post(':corporateId/employees')
    @ApiOperation({ summary: 'Add employee to corporate profile' })
    @ApiResponse({ status: 201, description: 'Employee added successfully' })
    @ApiResponse({ status: 400, description: 'License limit exceeded or user already exists' })
    @Roles('corporate_admin')
    @UseGuards(RolesGuard)
    async addEmployee(
        @Param('corporateId') corporateId: string,
        @Body() employeeData: AddEmployeeDto
    ) {
        await this.corporateService.addEmployee(corporateId, employeeData);
        return { message: 'Employee added successfully' };
    }

    @Delete(':corporateId/employees/:userId')
    @ApiOperation({ summary: 'Remove employee from corporate profile' })
    @ApiResponse({ status: 200, description: 'Employee removed successfully' })
    @Roles('corporate_admin')
    @UseGuards(RolesGuard)
    async removeEmployee(
        @Param('corporateId') corporateId: string,
        @Param('userId') userId: string
    ) {
        await this.corporateService.removeEmployee(corporateId, userId);
        return { message: 'Employee removed successfully' };
    }

    @Put(':corporateId/employees/:userId/role')
    @ApiOperation({ summary: 'Update employee role' })
    @ApiResponse({ status: 200, description: 'Employee role updated successfully' })
    @Roles('corporate_admin', 'corporate_manager')
    @UseGuards(RolesGuard)
    async updateEmployeeRole(
        @Param('corporateId') corporateId: string,
        @Param('userId') userId: string,
        @Body() roleData: UpdateEmployeeRoleDto
    ) {
        await this.corporateService.updateEmployeeRole(corporateId, userId, roleData.role);
        return { message: 'Employee role updated successfully' };
    }

    @Get(':corporateId/departments')
    @ApiOperation({ summary: 'Get departments of a corporate profile' })
    @ApiResponse({ status: 200, description: 'Departments list retrieved successfully' })
    async getDepartments(@Param('corporateId') corporateId: string) {
        const profile = await this.corporateService.getCorporateProfile(corporateId);
        return profile.organization.departments || [];
    }

    @Post(':corporateId/departments')
    @ApiOperation({ summary: 'Create department in corporate profile' })
    @ApiResponse({ status: 201, description: 'Department created successfully' })
    @Roles('corporate_admin')
    @UseGuards(RolesGuard)
    async createDepartment(
        @Param('corporateId') corporateId: string,
        @Body() departmentData: CreateDepartmentDto
    ) {
        await this.corporateService.createDepartment(corporateId, departmentData);
        return { message: 'Department created successfully' };
    }

    @Put(':corporateId/sso')
    @ApiOperation({ summary: 'Configure SSO provider for corporate profile' })
    @ApiResponse({ status: 200, description: 'SSO configured successfully' })
    @Roles('corporate_admin')
    @UseGuards(RolesGuard)
    async configureSSOProvider(
        @Param('corporateId') corporateId: string,
        @Body() ssoConfig: ConfigureSSODto
    ) {
        await this.corporateService.configureSSOProvider(corporateId, ssoConfig);
        return { message: 'SSO configured successfully' };
    }

    @Get(':corporateId/usage')
    @ApiOperation({ summary: 'Get corporate usage statistics' })
    @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
    @Roles('corporate_admin', 'corporate_manager')
    @UseGuards(RolesGuard)
    async getUsageStats(
        @Param('corporateId') corporateId: string,
        @Query('from') from?: string,
        @Query('to') to?: string
    ) {
        const dateRange = {
            from: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            to: to ? new Date(to) : new Date()
        };
        
        return this.corporateService.getCorporateUsageStats(corporateId, dateRange);
    }
}
