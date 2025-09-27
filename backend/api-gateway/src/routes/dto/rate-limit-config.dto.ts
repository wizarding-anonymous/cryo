import { IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateLimitConfigDto {
  @ApiProperty({
    description: 'Количество разрешенных запросов',
    example: 100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  requests!: number;

  @ApiProperty({
    description: 'Временное окно в миллисекундах',
    example: 60000,
    minimum: 1000,
  })
  @IsInt()
  @Min(1000)
  windowMs!: number;

  @ApiPropertyOptional({
    description: 'Пропускать успешные запросы при подсчете лимита',
    example: false,
    default: false,
  })
  @IsBoolean()
  skipSuccessfulRequests?: boolean;

  @ApiPropertyOptional({
    description: 'Пропускать неудачные запросы при подсчете лимита',
    example: false,
    default: false,
  })
  @IsBoolean()
  skipFailedRequests?: boolean;
}
