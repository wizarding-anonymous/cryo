import { IsString, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EmployeeRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  READONLY = 'readonly',
}

export class AddEmployeeDto {
  @ApiProperty({ description: 'User ID of the employee', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Employee role in the organization',
    enum: EmployeeRole,
    example: EmployeeRole.EMPLOYEE,
  })
  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @ApiPropertyOptional({ description: 'Department name', example: 'Разработка' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ description: 'Position title', example: 'Senior Developer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;
}
