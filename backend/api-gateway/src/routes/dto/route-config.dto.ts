import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HttpMethod } from '../../common/enums/http-method.enum';
import { ServiceName } from '../../common/enums/service-name.enum';
import { RateLimitConfigDto } from './rate-limit-config.dto';
import { IsSafePath } from '../../common/validators/safe-path.validator';

export class RouteConfigDto {
  @IsString()
  @IsSafePath({
    message: 'path must start with "/" and not contain ".." or spaces',
  })
  path!: string;

  @IsEnum(HttpMethod)
  method!: HttpMethod;

  @IsEnum(ServiceName)
  service!: ServiceName;

  @IsBoolean()
  requiresAuth!: boolean;

  @IsOptional()
  @Type(() => RateLimitConfigDto)
  rateLimit?: RateLimitConfigDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeout?: number;
}
