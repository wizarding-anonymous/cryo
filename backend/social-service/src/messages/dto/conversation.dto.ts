import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDto } from './message.dto';
import { UserStatus } from '../../status/entities/user-status.enum';

class ConversationFriendInfo {
  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty({ enum: UserStatus })
  onlineStatus!: UserStatus;
}

export class ConversationDto {
  @ApiProperty()
  friendId!: string;

  @ApiProperty({ type: () => ConversationFriendInfo })
  friendInfo!: ConversationFriendInfo;

  @ApiPropertyOptional({ type: () => MessageDto })
  lastMessage?: MessageDto;

  @ApiProperty()
  unreadCount!: number;
}
