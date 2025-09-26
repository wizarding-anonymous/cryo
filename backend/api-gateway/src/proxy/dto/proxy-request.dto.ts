import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod } from '../../common/enums/http-method.enum';
import { UserDto } from '../../common/dto/user.dto';

export class ProxyRequestDto {
  @ApiProperty({ enum: HttpMethod, description: 'HTTP method for the request' })
  @IsEnum(HttpMethod)
  method!: HttpMethod;

  @ApiProperty({ description: 'Target URL for the proxy request' })
  @IsString()
  @IsUrl()
  url!: string;

  @ApiProperty({ 
    description: 'HTTP headers as key-value pairs',
    example: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' }
  })
  @IsObject()
  headers!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Request body (for POST, PUT, PATCH requests)' })
  @IsOptional()
  body?: any;

  @ApiPropertyOptional({ 
    description: 'Query parameters as key-value pairs',
    example: { page: '1', limit: '10' }
  })
  @IsOptional()
  @IsObject()
  query?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Authenticated user information' })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserDto)
  user?: UserDto;
}