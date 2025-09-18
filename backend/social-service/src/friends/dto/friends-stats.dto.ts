import { ApiProperty } from '@nestjs/swagger';

export class FriendsStatsDto {
  @ApiProperty({
    description: 'Total number of friends',
    example: 25,
  })
  totalFriends!: number;

  @ApiProperty({
    description: 'Number of friends currently online',
    example: 8,
  })
  onlineFriends!: number;

  @ApiProperty({
    description: 'Number of pending friend requests',
    example: 3,
  })
  pendingRequests!: number;

  @ApiProperty({
    description: 'Number of sent friend requests awaiting response',
    example: 2,
  })
  sentRequests!: number;
}
