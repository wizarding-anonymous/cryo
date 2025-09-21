import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Номер страницы должен быть целым числом'
  })
  @Min(1, {
    message: 'Номер страницы должен быть больше 0'
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Лимит должен быть целым числом'
  })
  @Min(1, {
    message: 'Лимит должен быть больше 0'
  })
  @Max(50, {
    message: 'Максимальный лимит - 50 элементов'
  })
  limit?: number = 10;
}