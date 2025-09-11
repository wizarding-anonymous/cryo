import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsOptional,
  IsDate,
  MaxLength,
  Length,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SystemRequirements } from '../interfaces/game.interface';

class SystemRequirementsValidator implements SystemRequirements {
  @ApiProperty({ example: 'Windows 10, 8GB RAM', description: 'Minimum system requirements' })
  @IsString()
  @IsNotEmpty()
  minimum: string;

  @ApiProperty({ example: 'Windows 11, 16GB RAM, RTX 3060', description: 'Recommended system requirements' })
  @IsString()
  @IsNotEmpty()
  recommended: string;
}

export class CreateGameDto {
  @ApiProperty({ example: 'Cyberpunk 2077', description: 'The title of the game' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'A story-driven, open-world RPG...', description: 'Full description of the game' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Keanu Reeves, big city, lots of guns.', description: 'A short, catchy description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  shortDescription?: string;

  @ApiProperty({ example: 59.99, description: 'Price of the game' })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 'USD', default: 'RUB', description: 'Currency code (ISO 4217)' })
  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string = 'RUB';

  @ApiProperty({ example: 'RPG', description: 'The genre of the game' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  genre?: string;

  @ApiProperty({ example: 'CD PROJEKT RED', description: 'The developer of the game' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  developer?: string;

  @ApiProperty({ example: 'CD PROJEKT RED', description: 'The publisher of the game' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  publisher?: string;

  @ApiProperty({ example: '2020-12-10', description: 'The release date of the game' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  releaseDate?: Date;

  @ApiProperty({ type: [String], example: ['/img/cp1.jpg', '/img/cp2.jpg'], description: 'List of image URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiProperty({ type: SystemRequirementsValidator, description: 'System requirements for the game' })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SystemRequirementsValidator)
  systemRequirements?: SystemRequirements;

  @ApiProperty({ example: true, default: true, description: 'Is the game available for purchase?' })
  @IsBoolean()
  @IsOptional()
  available?: boolean = true;
}
