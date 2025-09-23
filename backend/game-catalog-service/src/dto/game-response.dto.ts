import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Game } from '../entities/game.entity';
import { SystemRequirements } from '../interfaces/game.interface';

export class SystemRequirementsDto implements SystemRequirements {
  @ApiProperty({
    description: 'Minimum system requirements',
    example: 'OS: Windows 10, CPU: Intel i3, RAM: 4GB, GPU: GTX 1050',
  })
  @Expose()
  minimum: string;

  @ApiProperty({
    description: 'Recommended system requirements',
    example: 'OS: Windows 11, CPU: Intel i5, RAM: 8GB, GPU: GTX 1660',
  })
  @Expose()
  recommended: string;
}

export class GameResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Title of the game',
    example: 'Cyberpunk 2077',
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: 'Full description of the game',
    example: 'An open-world, action-adventure story set in Night City...',
  })
  @Expose()
  description: string;

  @ApiProperty({
    description: 'Short description of the game',
    example: 'Futuristic RPG in Night City',
  })
  @Expose()
  shortDescription: string;

  @ApiProperty({
    description: 'Price of the game',
    example: 2999.99,
  })
  @Expose()
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  @Expose()
  currency: string;

  @ApiProperty({
    description: 'Genre of the game',
    example: 'Action RPG',
  })
  @Expose()
  genre: string;

  @ApiProperty({
    description: 'Developer of the game',
    example: 'CD Projekt RED',
  })
  @Expose()
  developer: string;

  @ApiProperty({
    description: 'Publisher of the game',
    example: 'CD Projekt',
  })
  @Expose()
  publisher: string;

  @ApiProperty({
    description: 'Release date of the game',
    example: '2020-12-10',
  })
  @Expose()
  @Type(() => Date)
  releaseDate: Date;

  @ApiProperty({
    description: 'Array of image URLs',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    type: [String],
  })
  @Expose()
  images: string[];

  @ApiProperty({
    description: 'System requirements for the game',
    type: SystemRequirementsDto,
  })
  @Expose()
  @Type(() => SystemRequirementsDto)
  systemRequirements: SystemRequirements;

  @ApiProperty({
    description: 'Whether the game is available for purchase',
    example: true,
  })
  @Expose()
  available: boolean;

  @ApiProperty({
    description: 'Date when the game was created in the catalog',
    example: '2023-01-15T10:30:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  constructor(game: Game) {
    this.id = game.id;
    this.title = game.title;
    this.description = game.description;
    this.shortDescription = game.shortDescription;
    this.price = game.price;
    this.currency = game.currency;
    this.genre = game.genre;
    this.developer = game.developer;
    this.publisher = game.publisher;
    this.releaseDate = game.releaseDate;
    this.images = game.images;
    this.systemRequirements = game.systemRequirements;
    this.available = game.available;
    this.createdAt = game.createdAt;
  }
}
