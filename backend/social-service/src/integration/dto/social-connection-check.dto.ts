import { ApiProperty } from '@nestjs/swagger';

export class SocialConnectionCheckDto {
  @ApiProperty({
    description: 'First user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Second user ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  targetUserId!: string;

  @ApiProperty({
    description: 'Whether the users are friends',
    example: true,
  })
  areFriends!: boolean;

  @ApiProperty({
    description: 'Date when friendship was established (if friends)',
    example: '2024-01-10T15:20:00Z',
    required: false,
  })
  friendshipDate?: Date;

  @ApiProperty({
    description: 'Type of social connection',
    enum: ['friends', 'none', 'pending_request'],
    example: 'friends',
  })
  connectionType!: 'friends' | 'none' | 'pending_request';

  @ApiProperty({
    description: 'Additional metadata about the connection',
    example: { mutualFriends: 3, connectionStrength: 'strong' },
    required: false,
  })
  metadata?: Record<string, any>;
}