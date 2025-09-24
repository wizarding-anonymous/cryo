import { ApiProperty } from '@nestjs/swagger';
import { PurchaseHistoryDto } from './purchase-history.dto';
import { PaginationMetaDto } from '../../common/dto';

export class HistoryResponseDto {
  @ApiProperty({
    description: 'List of purchase history entries with transaction details',
    type: [PurchaseHistoryDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174005',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        orderId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 59.99,
        currency: 'RUB',
        status: 'completed',
        paymentMethod: 'credit_card',
        metadata: {
          transactionId: 'tx_123456',
          gateway: 'stripe',
          cardLast4: '1234'
        },
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
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
  purchases!: PurchaseHistoryDto[];

  @ApiProperty({
    description: 'Pagination metadata for purchase history',
    type: PaginationMetaDto,
    example: {
      total: 25,
      page: 1,
      limit: 20,
      totalPages: 2
    }
  })
  pagination!: PaginationMetaDto;
}
