import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class FirstFriendWebhookDto {
  @ApiProperty({
    description: 'User ID who added their first friend',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'Friend ID that was added',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  friendId!: string;

  @ApiProperty({
    description: 'Timestamp when the friendship was established',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  timestamp?: Date;
}