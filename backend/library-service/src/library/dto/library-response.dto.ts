import { ApiProperty } from '@nestjs/swagger';
import { LibraryGameDto } from './library-game.dto';
import { PaginationMetaDto } from '../../common/dto';

export class LibraryResponseDto {
  @ApiProperty({
    description: 'List of games in user library',
    type: [LibraryGameDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        purchaseDate: '2024-01-15T10:30:00Z',
        purchasePrice: 59.99,
        currency: 'RUB',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        gameDetails: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Cyberpunk 2077',
          developer: 'CD Projekt RED',
          publisher: 'CD Projekt',
          images: ['https://example.com/cyberpunk-cover.jpg'],
          tags: ['RPG', 'Open World', 'Cyberpunk'],
          releaseDate: '2020-12-10T00:00:00Z'
        }
      }
    ]
  })
  games!: LibraryGameDto[];

  @ApiProperty({
    description: 'Pagination metadata with total count and page information',
    type: PaginationMetaDto,
    example: {
      total: 150,
      page: 1,
      limit: 20,
      totalPages: 8
    }
  })
  pagination!: PaginationMetaDto;
}
