import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GameDetailsDto {
  @ApiProperty({
    description: 'Game ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id!: string;

  @ApiProperty({
    description: 'Game title',
    example: 'Cyberpunk 2077',
  })
  title!: string;

  @ApiProperty({
    description: 'Game developer',
    example: 'CD Projekt RED',
  })
  developer!: string;

  @ApiProperty({
    description: 'Game publisher',
    example: 'CD Projekt',
  })
  publisher!: string;

  @ApiProperty({
    description: 'Game images',
    type: [String],
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
  })
  images!: string[];

  @ApiProperty({
    description: 'Game tags',
    type: [String],
    example: ['RPG', 'Open World', 'Cyberpunk'],
  })
  tags!: string[];

  @ApiProperty({
    description: 'Game release date',
    format: 'date-time',
    example: '2020-12-10T00:00:00Z',
  })
  releaseDate!: Date;
}

export class LibraryGameDto {
  @ApiProperty({
    description: 'Library entry ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  id!: string;

  @ApiProperty({
    description: 'Game ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  gameId!: string;

  @ApiProperty({
    description: 'User ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Purchase date',
    format: 'date-time',
    example: '2024-01-15T10:30:00Z',
  })
  purchaseDate!: Date;

  @ApiProperty({
    description: 'Purchase price',
    example: 59.99,
  })
  purchasePrice!: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  currency!: string;

  @ApiProperty({
    description: 'Order ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  orderId!: string;

  @ApiPropertyOptional({
    description: 'Game details (enriched from catalog service)',
    type: GameDetailsDto,
  })
  gameDetails?: GameDetailsDto;

  static fromEntity(entity: any, gameDetails?: GameDetailsDto): LibraryGameDto {
    const dto = new LibraryGameDto();
    dto.id = entity.id;
    dto.gameId = entity.gameId;
    dto.userId = entity.userId;
    dto.purchaseDate = entity.purchaseDate;
    dto.purchasePrice = Number(entity.purchasePrice);
    dto.currency = entity.currency;
    dto.orderId = entity.orderId;
    if (gameDetails) {
      dto.gameDetails = gameDetails;
    }
    return dto;
  }
}
