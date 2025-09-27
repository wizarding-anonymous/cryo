import { ApiProperty } from '@nestjs/swagger';

export class FriendsListResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'List of friend IDs',
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
  })
  friendIds!: string[];

  @ApiProperty({
    description: 'Total number of friends',
    example: 5,
  })
  totalFriends!: number;

  @ApiProperty({
    description: 'Timestamp when data was retrieved',
    example: '2024-01-15T10:30:00Z',
  })
  retrievedAt!: Date;
}