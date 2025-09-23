import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({
    description: 'The ID of the user to send the friend request to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  toUserId!: string;

  @ApiProperty({
    description: 'Optional message to send with the friend request',
    example: 'Hey, we played together yesterday!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
