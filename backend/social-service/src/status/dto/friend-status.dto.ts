import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../entities/user-status.enum';

export class FriendStatusDto {
  @ApiProperty({
    description: 'ID of the friend user',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  userId!: string;

  @ApiProperty({
    enum: UserStatus,
    description: 'Current online status of the friend',
    example: UserStatus.ONLINE,
  })
  status!: UserStatus;

  @ApiPropertyOptional({
    description: 'Game the friend is currently playing',
    example: 'Cyberpunk 2077',
  })
  currentGame?: string;

  @ApiProperty({
    description: 'Last time the friend was seen online',
    example: '2024-01-15T10:30:00Z',
  })
  lastSeen!: Date;
}
