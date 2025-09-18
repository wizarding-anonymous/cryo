import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FriendshipStatus } from '../entities/friendship-status.enum';
import { UserStatus } from '../../status/entities/user-status.enum';

class FriendInfo {
  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty({ enum: UserStatus })
  onlineStatus: UserStatus;

  @ApiProperty()
  lastSeen: Date;

  @ApiPropertyOptional()
  currentGame?: string;
}

export class FriendDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  friendId: string;

  @ApiProperty({ enum: FriendshipStatus })
  status: FriendshipStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: () => FriendInfo })
  friendInfo?: FriendInfo;
}
