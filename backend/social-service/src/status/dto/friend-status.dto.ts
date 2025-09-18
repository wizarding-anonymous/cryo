import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../entities/user-status.enum';

export class FriendStatusDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiPropertyOptional()
  currentGame?: string;

  @ApiProperty()
  lastSeen: Date;
}
