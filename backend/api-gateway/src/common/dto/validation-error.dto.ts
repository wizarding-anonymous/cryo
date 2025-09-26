import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationErrorDetailDto {
  @ApiProperty({ 
    description: 'Field that failed validation',
    example: 'email'
  })
  @IsString()
  field!: string;

  @ApiProperty({ 
    description: 'Validation error message',
    example: 'must be a valid email address'
  })
  @IsString()
  message!: string;

  @ApiProperty({ 
    description: 'Value that failed validation',
    example: 'invalid-email'
  })
  value?: any;

  @ApiPropertyOptional({ 
    description: 'Validation constraint that was violated',
    example: 'isEmail'
  })
  @IsOptional()
  @IsString()
  constraint?: string;
}

export class ValidationErrorDto {
  @ApiProperty({ 
    description: 'Error type',
    example: 'VALIDATION_ERROR'
  })
  @IsString()
  error!: string;

  @ApiProperty({ 
    description: 'General validation error message',
    example: 'Request validation failed'
  })
  @IsString()
  message!: string;

  @ApiProperty({ 
    description: 'HTTP status code',
    example: 400
  })
  statusCode!: number;

  @ApiProperty({ 
    description: 'Detailed validation errors',
    type: [ValidationErrorDetailDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidationErrorDetailDto)
  details!: ValidationErrorDetailDto[];
}