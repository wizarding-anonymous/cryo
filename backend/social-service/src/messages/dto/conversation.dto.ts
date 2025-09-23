import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDto } from './message.dto';
import { UserStatus } from '../../status/entities/user-status.enum';

class ConversationFriendInfo {
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
}

export class ConversationDto {
  @ApiProperty({
    description: 'ID of the friend user',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  friendId!: string;

  @ApiProperty({
    type: () => ConversationFriendInfo,
    description: 'Information about the friend',
  })
  friendInfo!: ConversationFriendInfo;

  @ApiPropertyOptional({
    type: () => MessageDto,
    description: 'Last message in the conversation',
  })
  lastMessage?: MessageDto;

  @ApiProperty({
    description: 'Number of unread messages in the conversation',
    example: 3,
  })
  unreadCount!: number;
}
