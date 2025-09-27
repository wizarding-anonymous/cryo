import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HttpMethod } from '../../common/enums/http-method.enum';
import { ServiceName } from '../../common/enums/service-name.enum';

export class RateLimitConfigDto {
  @ApiProperty({
    description: 'Number of requests allowed',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  requests!: number;

  @ApiProperty({
    description: 'Time window in milliseconds',
    example: 60000,
    minimum: 1000,
  })
  @IsInt()
  @Min(1000)
  windowMs!: number;

  @ApiPropertyOptional({
    description: 'Skip successful requests in rate limiting',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  skipSuccessfulRequests?: boolean;

  @ApiPropertyOptional({
    description: 'Skip failed requests in rate limiting',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  skipFailedRequests?: boolean;
}

export class RouteConfigDto {
  @ApiProperty({
    description: 'Route path pattern',
    example: '/api/users/profile',
  })
  @IsString()
  path!: string;

  @ApiProperty({
    enum: HttpMethod,
    description: 'HTTP method',
  })
  @IsEnum(HttpMethod)
  method!: HttpMethod;

  @ApiProperty({
    enum: ServiceName,
    description: 'Target service name',
  })
  @IsEnum(ServiceName)
  service!: ServiceName;

  @ApiProperty({
    description: 'Whether authentication is required',
    example: true,
  })
  @IsBoolean()
  requiresAuth!: boolean;

  @ApiPropertyOptional({
    description: 'Rate limiting configuration',
    type: RateLimitConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitConfigDto)
  rateLimit?: RateLimitConfigDto;

  @ApiPropertyOptional({
    description: 'Request timeout in milliseconds',
    example: 5000,
    minimum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  timeout?: number;
}
