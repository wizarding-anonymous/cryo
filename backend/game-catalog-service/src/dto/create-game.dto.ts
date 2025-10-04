import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDateString,
  IsObject,
  Min,
  Max,
  Length,
  IsIn,
} from 'class-validator';

export class CreateGameDto {
  @ApiProperty({
    description: 'Game title',
    example: 'The Witcher 3: Wild Hunt',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiProperty({
    description: 'Game description',
    example: 'An epic RPG adventure in a fantasy world',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Short game description',
    example: 'Epic RPG adventure',
    required: false,
  })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiProperty({
    description: 'Game price in rubles',
    example: 1999.99,
    minimum: 0,
    maximum: 999999.99,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
    default: 'RUB',
  })
  @IsOptional()
  @IsString()
  @IsIn(['RUB', 'USD', 'EUR'])
  currency?: string = 'RUB';

  @ApiProperty({
    description: 'Game developer',
    example: 'CD Projekt RED',
  })
  @IsString()
  @Length(1, 255)
  developer: string;

  @ApiProperty({
    description: 'Game publisher',
    example: 'CD Projekt',
  })
  @IsString()
  @Length(1, 255)
  publisher: string;

  @ApiProperty({
    description: 'Game genre',
    example: 'RPG',
  })
  @IsString()
  @Length(1, 100)
  genre: string;

  @ApiProperty({
    description: 'Game release date',
    example: '2015-05-19',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiProperty({
    description: 'Game availability status',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  available?: boolean = true;

  @ApiProperty({
    description: 'Game images URLs',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({
    description: 'System requirements',
    example: {
      minimum: 'OS: Windows 7 64-bit, Processor: Intel CPU Core i5-2500K 3.3GHz',
      recommended: 'OS: Windows 10 64-bit, Processor: Intel CPU Core i7 3770 3.4 GHz'
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  systemRequirements?: {
    minimum?: string;
    recommended?: string;
  };
}