import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty({
    description: 'Unique identifier of the message',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the user who sent the message',
    example: 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  fromUserId!: string;

  @ApiProperty({
    description: 'ID of the user who received the message',
    example: 'c2ggde99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  toUserId!: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'Hello! How are you doing?',
  })
  content!: string;

  @ApiProperty({
    description: 'Whether the message has been read by the recipient',
    example: false,
  })
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'Date when the message was read',
    example: '2024-01-15T10:35:00Z',
  })
  readAt?: Date;

  @ApiProperty({
    description: 'Date when the message was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt!: Date;
}
