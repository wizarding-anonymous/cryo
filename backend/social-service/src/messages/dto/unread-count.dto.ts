import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountDto {
  @ApiProperty({
    description: 'Total number of unread messages',
    example: 5,
  })
  totalUnread!: number;

  @ApiProperty({
    description: 'Number of conversations with unread messages',
    example: 3,
  })
  unreadConversations!: number;
}
