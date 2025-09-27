import {
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpMethod, IsSafePath, IsJsonObject } from '../validators';

export class ProxyHeadersDto {
  @ApiPropertyOptional({
    description: 'Content-Type header',
    example: 'application/json',
  })
  @IsOptional()
  @IsString()
  'content-type'?: string;

  @ApiPropertyOptional({
    description: 'Authorization header',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  authorization?: string;

  @ApiPropertyOptional({
    description: 'User-Agent header',
    example: 'API-Gateway/1.0',
  })
  @IsOptional()
  @IsString()
  'user-agent'?: string;

  @ApiPropertyOptional({
    description: 'Accept header',
    example: 'application/json',
  })
  @IsOptional()
  @IsString()
  accept?: string;

  // Allow additional headers
  [key: string]: string | undefined;
}

export class ProxyRequestDto {
  @ApiProperty({
    description: 'HTTP method for the request',
    example: 'GET',
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
  @IsHttpMethod()
  method!: string;

  @ApiProperty({
    description: 'Request path (must be safe and absolute)',
    example: '/api/users/123',
  })
  @IsSafePath()
  path!: string;

  @ApiPropertyOptional({
    description: 'Request headers',
    type: ProxyHeadersDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProxyHeadersDto)
  headers?: ProxyHeadersDto;

  @ApiPropertyOptional({
    description: 'Request body (for POST/PUT requests)',
    example: { name: 'John Doe', email: 'john@example.com' },
  })
  @IsOptional()
  @IsJsonObject()
  body?: any;

  @ApiPropertyOptional({
    description: 'Query parameters',
    example: { page: '1', limit: '10' },
  })
  @IsOptional()
  @IsObject()
  query?: Record<string, string>;
}
