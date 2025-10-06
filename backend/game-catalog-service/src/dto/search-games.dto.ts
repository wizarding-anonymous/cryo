import {
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsNumber,
  Min,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { GetGamesDto } from './get-games.dto';

// Custom validator for price range validation
function IsGreaterThanOrEqual(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterThanOrEqual',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return typeof value === 'number' && typeof relatedValue === 'number'
            ? value >= relatedValue
            : true; // Skip validation if either value is not a number
        },
      },
    });
  };
}

export class SearchGamesDto extends GetGamesDto {
  @ApiProperty({
    description: 'The search query string to find games by title',
    minLength: 1,
    maxLength: 255,
    required: false,
    example: 'cyberpunk',
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MaxLength(255, { message: 'Search query cannot exceed 255 characters' })
  @Transform(
    ({ value }) =>
      (typeof value === 'string' ? value.trim() || undefined : value) as
        | string
        | undefined,
  )
  q?: string;

  @ApiProperty({
    description: 'Search type - determines how the search is performed',
    enum: ['title', 'description', 'all'],
    required: false,
    default: 'title',
    example: 'title',
  })
  @IsOptional()
  @IsString()
  @IsIn(['title', 'description', 'all'], {
    message: 'Search type must be one of: title, description, all',
  })
  searchType?: 'title' | 'description' | 'all' = 'title';

  @ApiProperty({
    description: 'Minimum price filter for search results',
    required: false,
    example: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  @IsNumber({}, { message: 'Minimum price must be a number' })
  @Min(0, { message: 'Minimum price cannot be negative' })
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter for search results',
    required: false,
    example: 5000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(String(value)) : undefined))
  @IsNumber({}, { message: 'Maximum price must be a number' })
  @Min(0, { message: 'Maximum price cannot be negative' })
  @ValidateIf((o) => o.minPrice !== undefined && o.maxPrice !== undefined)
  @IsGreaterThanOrEqual('minPrice', {
    message: 'Maximum price must be greater than or equal to minimum price',
  })
  maxPrice?: number;
}
