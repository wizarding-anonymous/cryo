import { IsBoolean, IsInt, Min } from 'class-validator';

export class RateLimitConfigDto {
  @IsInt()
  @Min(1)
  requests!: number;

  @IsInt()
  @Min(1)
  windowMs!: number;

  @IsBoolean()
  // optional flag: defaults handled by business logic when not provided
  skipSuccessfulRequests?: boolean;

  @IsBoolean()
  skipFailedRequests?: boolean;
}
