import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCorporateProfileDto {
  @ApiProperty({ description: 'Company name' })
  @IsString()
  companyName: string;

  @ApiProperty({ description: 'Legal company name' })
  @IsString()
  legalName: string;

  @ApiProperty({ description: 'INN (Russian tax number)' })
  @IsString()
  inn: string;

  @ApiProperty({ description: 'OGRN (Russian registration number)' })
  @IsString()
  ogrn: string;

  @ApiProperty({ description: 'Industry sector' })
  @IsString()
  industry: string;

  @ApiProperty({ description: 'Company size', enum: ['small', 'medium', 'large', 'enterprise'] })
  @IsEnum(['small', 'medium', 'large', 'enterprise'])
  companySize: 'small' | 'medium' | 'large' | 'enterprise';

  @ApiProperty({ description: 'Annual revenue', required: false })
  @IsOptional()
  @IsNumber()
  annualRevenue?: number;

  @ApiProperty({ description: 'Headquarters location' })
  @IsString()
  headquarters: string;

  @ApiProperty({ description: 'Company website' })
  @IsString()
  website: string;
}

export class AddEmployeeDto {
  @ApiProperty({ description: 'User ID of the employee' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Employee role' })
  @IsString()
  role: string;

  @ApiProperty({ description: 'Department', required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ description: 'Position title', required: false })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiProperty({ description: 'Permissions array', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Department name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Department description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Parent department ID', required: false })
  @IsOptional()
  @IsString()
  parentDepartmentId?: string;

  @ApiProperty({ description: 'Manager user ID', required: false })
  @IsOptional()
  @IsString()
  managerUserId?: string;

  @ApiProperty({ description: 'Budget limit', required: false })
  @IsOptional()
  @IsNumber()
  budgetLimit?: number;
}

export class ConfigureSSODto {
  @ApiProperty({ description: 'SSO provider', enum: ['azure_ad', 'google_workspace', 'okta', 'custom'] })
  @IsEnum(['azure_ad', 'google_workspace', 'okta', 'custom'])
  provider: 'azure_ad' | 'google_workspace' | 'okta' | 'custom';

  @ApiProperty({ description: 'Client ID' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'Client secret' })
  @IsString()
  clientSecret: string;

  @ApiProperty({ description: 'Domain' })
  @IsString()
  domain: string;

  @ApiProperty({ description: 'Redirect URI' })
  @IsString()
  redirectUri: string;

  @ApiProperty({ description: 'Scopes array' })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];
}

export class UpdateEmployeeRoleDto {
  @ApiProperty({ description: 'New role for the employee' })
  @IsString()
  role: string;
}