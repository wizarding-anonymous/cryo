import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FriendshipStatus } from '../entities/friendship-status.enum';
import { UserStatus } from '../../status/entities/user-status.enum';

export class FriendInfo {
  @ApiProperty({
    description: 'Username of the friend',
    example: 'john_doe',
  })
  username!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL of the friend',
    example: 'https://example.com/avatar.jpg',
  })
  avatar?: string;

  @ApiProperty({
    enum: UserStatus,
    description: 'Current online status of the friend',
    example: UserStatus.ONLINE,
  })
  onlineStatus!: UserStatus;

  @ApiProperty({
    description: 'Last time the friend was seen online',
    example: '2024-01-15T10:30:00Z',
  })
  lastSeen!: Date;

  @ApiPropertyOptional({
    description: 'Game the friend is currently playing',
    example: 'Cyberpunk 2077',
  })
  currentGame?: string;
}

export class FriendDto {
  @ApiProperty({
    description: 'Unique identifier of the friendship record',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the user who initiated or received the friend request',
    example: 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  userId!: string;

  @ApiProperty({
    description: 'ID of the friend user',
    example: 'c2ggde99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  friendId!: string;

  @ApiProperty({
    enum: FriendshipStatus,
    description: 'Current status of the friendship',
    example: FriendshipStatus.ACCEPTED,
  })
  status!: FriendshipStatus;

  @ApiProperty({
    description: 'Date when the friendship was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    type: () => FriendInfo,
    description: 'Additional information about the friend',
  })
  friendInfo?: FriendInfo;
}
