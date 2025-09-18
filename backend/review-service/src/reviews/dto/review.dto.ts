import {
  IsString,
  IsNotEmpty,
  Length,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @Length(10, 1000)
  text: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  @Length(10, 1000)
  text?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
